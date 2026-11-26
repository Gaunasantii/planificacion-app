import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
} from '@mikro-orm/core';
import { Assessment } from './Assessment';
import { CourseEnrollment } from './CourseEnrollment';
import { ConceptualScaleItem } from './ConceptualScaleItem';

@Entity()
@Unique({ properties: ['assessment', 'enrollment'] })
export class Grade {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Assessment)
  assessment!: Assessment;

  @ManyToOne(() => CourseEnrollment)
  enrollment!: CourseEnrollment;

  @Property({ type: 'float', nullable: true })
  numericValue?: number | null;

  @ManyToOne(() => ConceptualScaleItem, { nullable: true })
  conceptualItem?: ConceptualScaleItem | null;

  @Property({ nullable: true })
  observations?: string | null;
}
