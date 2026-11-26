import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Unique,
} from '@mikro-orm/core';
import { Period } from './Period';
import { CourseEnrollment } from './CourseEnrollment';
import { ConceptualScaleItem } from './ConceptualScaleItem';

@Entity()
@Unique({ properties: ['period', 'enrollment'] })
export class PeriodGrade {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Period)
  period!: Period;

  @ManyToOne(() => CourseEnrollment)
  enrollment!: CourseEnrollment;

  @Property({ type: 'float', nullable: true })
  calculatedNumeric?: number | null;

  @Property({ type: 'float', nullable: true })
  finalNumeric?: number | null;

  @ManyToOne(() => ConceptualScaleItem, { nullable: true })
  finalConceptualItem?: ConceptualScaleItem | null;

  @Property({ default: false })
  isOverridden: boolean = false;
}
