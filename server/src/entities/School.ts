import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  OneToMany,
  Collection,
} from '@mikro-orm/core';
import { SchoolMember } from './SchoolMember';
import { Course } from './Course';
import { Student } from './Student';

export enum EducationLevel {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  BOTH = 'BOTH',
}

export enum PeriodType {
  BIMESTER = 'BIMESTER',
  TRIMESTER = 'TRIMESTER',
  QUADRIMESTER = 'QUADRIMESTER',
}

@Entity()
export class School {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property()
  name!: string;

  @Enum(() => EducationLevel)
  educationLevel!: EducationLevel;

  @Property()
  academicYear!: number;

  @Enum(() => PeriodType)
  defaultPeriodType!: PeriodType;

  @Property({ onCreate: () => new Date(), defaultRaw: 'now()' })
  createdAt: Date = new Date();

  @OneToMany(() => SchoolMember, (member) => member.school)
  members = new Collection<SchoolMember>(this);

  @OneToMany(() => Course, (course) => course.school)
  courses = new Collection<Course>(this);

  @OneToMany(() => Student, (student) => student.school)
  students = new Collection<Student>(this);
}
