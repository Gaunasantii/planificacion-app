import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Unique,
} from '@mikro-orm/core';
import { ClassSession } from './ClassSession';
import { CourseEnrollment } from './CourseEnrollment';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  JUSTIFIED_ABSENT = 'JUSTIFIED_ABSENT',
}

@Entity()
@Unique({ properties: ['session', 'enrollment'] })
export class AttendanceRecord {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => ClassSession)
  session!: ClassSession;

  @ManyToOne(() => CourseEnrollment)
  enrollment!: CourseEnrollment;

  @Enum(() => AttendanceStatus)
  status!: AttendanceStatus;

  @Property({ nullable: true })
  notes?: string | null;
}
