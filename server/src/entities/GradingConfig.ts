import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
  OneToMany,
  Enum,
  Collection,
} from '@mikro-orm/core';
import { Course } from './Course';
import { ConceptualScaleItem } from './ConceptualScaleItem';

export enum ScaleType {
  NUMERIC_10 = 'NUMERIC_10',
  NUMERIC_100 = 'NUMERIC_100',
  CONCEPTUAL = 'CONCEPTUAL',
}

@Entity()
export class GradingConfig {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @OneToOne(() => Course, (course) => course.gradingConfig, { owner: true })
  course!: Course;

  @Enum({ items: () => ScaleType, default: ScaleType.NUMERIC_10 })
  scaleType: ScaleType = ScaleType.NUMERIC_10;

  @Property({ default: 0 })
  attendanceWeight: number = 0;

  @Property({ default: 70 })
  examWeight: number = 70;

  @Property({ default: 30 })
  assignmentWeight: number = 30;

  @Property({ default: true })
  justifiedCountsAsPresent: boolean = true;

  @OneToMany(() => ConceptualScaleItem, (item) => item.gradingConfig)
  conceptualScaleItems = new Collection<ConceptualScaleItem>(this);
}
