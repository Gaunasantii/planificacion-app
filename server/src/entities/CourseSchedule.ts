import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { Course } from './Course';

@Entity()
export class CourseSchedule {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @Property()
  dayOfWeek!: number;

  @Property()
  startTime!: string;

  @Property()
  endTime!: string;
}
