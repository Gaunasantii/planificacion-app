import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  OneToOne,
  Enum,
  Collection,
} from '@mikro-orm/core';
import { School, PeriodType } from './School';
import { SchoolMember } from './SchoolMember';
import { CourseSchedule } from './CourseSchedule';
import { GradingConfig } from './GradingConfig';
import { Period } from './Period';
import { CourseEnrollment } from './CourseEnrollment';
import { ClassSession } from './ClassSession';
import { Assessment } from './Assessment';

@Entity()
export class Course {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => School)
  school!: School;

  @ManyToOne(() => SchoolMember)
  teacher!: SchoolMember;

  @Property()
  name!: string;

  @Property({ nullable: true })
  division?: string | null;

  @Property({ nullable: true })
  subject?: string | null;

  @Property()
  academicYear!: number;

  @Enum(() => PeriodType)
  periodType!: PeriodType;

  @Property({ onCreate: () => new Date(), defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @OneToMany(() => CourseSchedule, (schedule) => schedule.course)
  schedules = new Collection<CourseSchedule>(this);

  @OneToOne(() => GradingConfig, (config) => config.course)
  gradingConfig?: GradingConfig;

  @OneToMany(() => Period, (period) => period.course)
  periods = new Collection<Period>(this);

  @OneToMany(() => CourseEnrollment, (enrollment) => enrollment.course)
  enrollments = new Collection<CourseEnrollment>(this);

  @OneToMany(() => ClassSession, (session) => session.course)
  sessions = new Collection<ClassSession>(this);

  @OneToMany(() => Assessment, (assessment) => assessment.course)
  assessments = new Collection<Assessment>(this);
}
