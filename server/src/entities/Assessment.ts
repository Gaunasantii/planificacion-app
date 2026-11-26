import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
} from '@mikro-orm/core';
import { Course } from './Course';
import { Period } from './Period';

export enum AssessmentType {
  EXAM = 'EXAM',
  ASSIGNMENT = 'ASSIGNMENT',
  MAKEUP = 'MAKEUP',
}

@Entity()
export class Assessment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @ManyToOne(() => Period)
  period!: Period;

  @Property()
  title!: string;

  @Enum(() => AssessmentType)
  type!: AssessmentType;

  @Property({ type: 'date' })
  date!: Date;

  @Property({ type: 'float', default: 1 })
  weight: number = 1;
}
