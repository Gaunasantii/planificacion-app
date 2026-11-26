import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/core';
import { GradingConfig } from './GradingConfig';

@Entity()
export class ConceptualScaleItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => GradingConfig)
  gradingConfig!: GradingConfig;

  @Property()
  label!: string;

  @Property()
  shortCode!: string;

  @Property({ type: 'float' })
  numericValue!: number;

  @Property()
  order!: number;
}
