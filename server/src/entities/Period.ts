import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { Course } from './Course';

@Entity()
export class Period {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Course)
  course!: Course;

  @Property()
  name!: string;

  @Property()
  order!: number;

  @Property({ type: 'date' })
  startDate!: Date;

  @Property({ type: 'date' })
  endDate!: Date;

  @Property({ default: false })
  isRecovery: boolean = false;
}
