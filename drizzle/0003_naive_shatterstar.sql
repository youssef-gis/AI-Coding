CREATE TABLE `course_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "course_ratings_rating_range" CHECK("course_ratings"."rating" BETWEEN 1 AND 5 AND typeof("course_ratings"."rating") = 'integer')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_ratings_course_user_unique` ON `course_ratings` (`course_id`,`user_id`);