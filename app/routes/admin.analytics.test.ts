import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import {
  getAdminAnalyticsSummary,
  getAdminRevenueTimeSeries,
  getAdminPerCourseBreakdown,
  getInstructorsWithCourses,
} from "~/services/analyticsService";
import { loader } from "./admin.analytics";

vi.mock("~/lib/session", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("~/services/userService", () => ({ getUserById: vi.fn() }));
vi.mock("~/services/analyticsService", () => ({
  getAdminAnalyticsSummary: vi.fn(() => ({
    totalRevenue: 0,
    totalEnrollments: 0,
    topEarningCourse: null,
  })),
  getAdminRevenueTimeSeries: vi.fn(() => []),
  getAdminPerCourseBreakdown: vi.fn(() => []),
  getInstructorsWithCourses: vi.fn(() => []),
}));

function load(query = "") {
  return loader({
    request: new Request(`http://localhost/admin/analytics${query}`),
    params: {},
    context: {},
  } as Parameters<typeof loader>[0]);
}

function setUser(role: UserRole) {
  vi.mocked(getUserById).mockReturnValue({
    id: 1,
    role,
  } as NonNullable<ReturnType<typeof getUserById>>);
}

describe("admin analytics loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue(1);
    setUser(UserRole.Admin);
  });

  it.each([UserRole.Student, UserRole.Instructor])(
    "rejects the %s role before reading analytics",
    async (role) => {
      setUser(role);
      await expect(load()).rejects.toMatchObject({ init: { status: 403 } });
      expect(getAdminAnalyticsSummary).not.toHaveBeenCalled();
      expect(getAdminRevenueTimeSeries).not.toHaveBeenCalled();
    }
  );

  it("rejects a session whose user no longer exists", async () => {
    vi.mocked(getUserById).mockReturnValue(undefined);
    await expect(load()).rejects.toMatchObject({ init: { status: 403 } });
    expect(getAdminAnalyticsSummary).not.toHaveBeenCalled();
    expect(getAdminRevenueTimeSeries).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    await expect(load()).rejects.toMatchObject({ init: { status: 401 } });
    expect(getAdminAnalyticsSummary).not.toHaveBeenCalled();
    expect(getAdminRevenueTimeSeries).not.toHaveBeenCalled();
  });

  it.each(["", "?period=invalid"])("defaults to 30d for %s", async (query) => {
    expect((await load(query)).period).toBe("30d");
    expect(getAdminAnalyticsSummary).toHaveBeenCalledWith({ period: "30d" });
    expect(getAdminRevenueTimeSeries).toHaveBeenCalledWith({ period: "30d" });
  });

  it("returns the platform series without applying the instructor filter", async () => {
    const series = [{ date: "2026-06-15", revenue: 14998 }];
    vi.mocked(getAdminRevenueTimeSeries).mockReturnValueOnce(series);

    const result = await load("?period=7d&instructor=42");

    expect(getAdminRevenueTimeSeries).toHaveBeenCalledWith({ period: "7d" });
    expect(result.timeSeries).toEqual(series);
  });

  it("filters courses server-side while keeping summary totals platform-wide", async () => {
    const instructors = [{ id: 42, name: "Course Owner" }];
    vi.mocked(getInstructorsWithCourses).mockReturnValueOnce(instructors);
    const result = await load("?period=12m&instructor=42");
    expect(getAdminPerCourseBreakdown).toHaveBeenCalledWith({
      period: "12m",
      instructorId: 42,
    });
    expect(getAdminAnalyticsSummary).toHaveBeenCalledWith({ period: "12m" });
    expect(result.selectedInstructorId).toBe(42);
    expect(result.instructors).toEqual(instructors);
  });

  it.each(["", "all", "invalid", "0", "-1", "1.5", "Infinity"])(
    "defaults to all instructors for %s",
    async (instructor) => {
      const result = await load(`?instructor=${instructor}`);
      expect(getAdminPerCourseBreakdown).toHaveBeenCalledWith({
        period: "30d",
        instructorId: undefined,
      });
      expect(result.selectedInstructorId).toBeNull();
    }
  );

  it.each(["7d", "30d", "12m", "all"])(
    "loads the selected %s summary for admins",
    async (period) => {
      const result = await load(`?period=${period}`);
      expect(result.period).toBe(period);
      expect(result.summary).toEqual({
        totalRevenue: 0,
        totalEnrollments: 0,
        topEarningCourse: null,
      });
      expect(getAdminAnalyticsSummary).toHaveBeenCalledWith({ period });
      expect(getAdminRevenueTimeSeries).toHaveBeenCalledWith({ period });
      expect(result.timeSeries).toEqual([]);
    }
  );
});
