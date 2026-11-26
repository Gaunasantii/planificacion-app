import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Unique,
} from '@mikro-orm/core';
import { Course } from './Course';
import { Student } from './Student';

export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  DROPPED = 'DROPPED',
  TRANSFERRED = 'TRANSFERRED',
}

@Entity()
@Unique({ properties: ['course', 'student'] })
export class CourseEnrollment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @ManyToOne(() => Student)
  student!: Student;

  @Enum({ items: () => EnrollmentStatus, default: EnrollmentStatus.ACTIVE })
  status: EnrollmentStatus = EnrollmentStatus.ACTIVE;

  @Property({ onCreate: () => new Date(), defaultRaw: 'now()' })
  enrolledAt: Date = new Date();
}
