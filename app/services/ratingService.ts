import { and, eq, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  courseRatings,
  courses,
  users,
  enrollments,
  UserRole,
} from "~/db/schema";

// Correlated aggregates keep course lists paginated correctly and avoid per-card queries.
// Qualify courses.id explicitly: Drizzle removes column qualifiers in single-table selects.
export const courseRatingFields = {
  averageRating: sql<
    number | null
  >`(select avg(rating) from course_ratings where course_id = courses.id)`,
  ratingCount: sql<number>`(select count(*) from course_ratings where course_id = courses.id)`,
};

export function getUserCourseRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function canRateCourse(userId: number, courseId: number) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();
  return (
    user?.role === UserRole.Student &&
    !!course &&
    course.instructorId !== userId &&
    !!db
      .select()
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))
      )
      .get()
  );
}

export function saveCourseRating(
  userId: number,
  courseId: number,
  rating: number
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Choose a whole-star rating from 1 to 5.");
  }
  if (!canRateCourse(userId, courseId)) {
    throw new Error("Only enrolled students can rate this course.");
  }
  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .onConflictDoUpdate({
      target: [courseRatings.courseId, courseRatings.userId],
      set: { rating, updatedAt: new Date().toISOString() },
    })
    .returning()
    .get();
}
