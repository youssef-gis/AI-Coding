import { courses as schemaCourses } from "~/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import { courseRatings, enrollments, users, UserRole } from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));
import {
  canRateCourse,
  getUserCourseRating,
  saveCourseRating,
} from "./ratingService";
import {
  buildCourseQuery,
  getAllCourses,
  getCourseById,
  getCourseBySlug,
  getCourseWithDetails,
  getCoursesByInstructor,
} from "./courseService";
import { getUserEnrolledCourses } from "./enrollmentService";

describe("course star ratings", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    testDb
      .insert(enrollments)
      .values({ userId: base.user.id, courseId: base.course.id })
      .run();
  });

  it("returns an empty summary for unrated courses", () => {
    expect(getCourseWithDetails(base.course.id)).toMatchObject({
      averageRating: null,
      ratingCount: 0,
    });
  });

  it("persists a rating and updates it without creating another vote", () => {
    saveCourseRating(base.user.id, base.course.id, 2);
    saveCourseRating(base.user.id, base.course.id, 5);
    expect(getUserCourseRating(base.user.id, base.course.id)?.rating).toBe(5);
    expect(testDb.select().from(courseRatings).all()).toHaveLength(1);
    expect(getCourseWithDetails(base.course.id)).toMatchObject({
      averageRating: 5,
      ratingCount: 1,
    });
  });

  it("shows the same average across course queries and enrolled courses", () => {
    const second = testDb
      .insert(users)
      .values({
        name: "Another student",
        email: "another@example.com",
        role: UserRole.Student,
      })
      .returning()
      .get();
    testDb
      .insert(enrollments)
      .values({ userId: second.id, courseId: base.course.id })
      .run();
    saveCourseRating(base.user.id, base.course.id, 5);
    saveCourseRating(second.id, base.course.id, 2);
    const summaries = [
      getCourseById(base.course.id),
      getCourseBySlug(base.course.slug),
      getCourseWithDetails(base.course.id),
      getAllCourses()[0],
      getCoursesByInstructor(base.instructor.id)[0],
      buildCourseQuery(null, null, null, null, 50, 0)[0],
      getUserEnrolledCourses(base.user.id)[0],
    ];
    for (const summary of summaries)
      expect(summary).toMatchObject({ averageRating: 3.5, ratingCount: 2 });
    saveCourseRating(second.id, base.course.id, 3);
    expect(getCourseWithDetails(base.course.id)).toMatchObject({
      averageRating: 4,
      ratingCount: 2,
    });
  });

  it("keeps ratings isolated between courses and preserves pagination", () => {
    const other = testDb
      .insert(schemaCourses)
      .values({
        title: "Other course",
        slug: "other-course",
        description: "Other",
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        status: base.course.status,
      })
      .returning()
      .get();
    testDb
      .insert(enrollments)
      .values({ userId: base.user.id, courseId: other.id })
      .run();
    saveCourseRating(base.user.id, base.course.id, 5);
    saveCourseRating(base.user.id, other.id, 1);
    expect(getCourseById(base.course.id)).toMatchObject({
      averageRating: 5,
      ratingCount: 1,
    });
    expect(getCourseById(other.id)).toMatchObject({
      averageRating: 1,
      ratingCount: 1,
    });
    const page = buildCourseQuery(null, null, null, "title", 1, 0);
    expect(page).toHaveLength(1);
    expect(page[0]).toMatchObject({
      id: other.id,
      averageRating: 1,
      ratingCount: 1,
    });
  });

  it.each([0, 6, -1, 2.5, NaN, Infinity])(
    "rejects invalid rating %s",
    (rating) => {
      expect(() =>
        saveCourseRating(base.user.id, base.course.id, rating)
      ).toThrow("whole-star");
      expect(testDb.select().from(courseRatings).all()).toHaveLength(0);
    }
  );

  it("rejects unenrolled students, instructors, missing users and missing courses", () => {
    const outsider = testDb
      .insert(users)
      .values({
        name: "Outsider",
        email: "outside@example.com",
        role: UserRole.Student,
      })
      .returning()
      .get();
    testDb
      .insert(enrollments)
      .values({ userId: base.instructor.id, courseId: base.course.id })
      .run();
    for (const userId of [outsider.id, base.instructor.id, 999]) {
      expect(canRateCourse(userId, base.course.id)).toBe(false);
      expect(() => saveCourseRating(userId, base.course.id, 4)).toThrow(
        "enrolled students"
      );
    }
    expect(() => saveCourseRating(base.user.id, 999, 4)).toThrow(
      "enrolled students"
    );
  });

  it("enforces uniqueness and whole-star constraints in the database", () => {
    const values = {
      userId: base.user.id,
      courseId: base.course.id,
      rating: 4,
    };
    testDb.insert(courseRatings).values(values).run();
    expect(() => testDb.insert(courseRatings).values(values).run()).toThrow();
    for (const rating of [0, 6, 1.5]) {
      expect(() =>
        testDb
          .insert(courseRatings)
          .values({ ...values, userId: base.instructor.id, rating })
          .run()
      ).toThrow();
    }
  });
});
