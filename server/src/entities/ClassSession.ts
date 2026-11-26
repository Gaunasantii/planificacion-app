import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
} from '@mikro-orm/core';
import { Course } from './Course';

@Entity()
@Unique({ properties: ['course', 'date'] })
export class ClassSession {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @Property({ type: 'date' })
  date!: Date;

  @Property({ nullable: true })
  topic?: string | null;

  @Property({ default: false })
  isCancelled: boolean = false;
}
