import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Unique,
} from '@mikro-orm/core';
import { User } from './User';
import { School } from './School';

export enum SchoolRole {
  TEACHER = 'TEACHER',
  PRECEPTOR = 'PRECEPTOR',
  VICE_PRINCIPAL = 'VICE_PRINCIPAL',
  PRINCIPAL = 'PRINCIPAL',
  ADMIN = 'ADMIN',
}

@Entity()
@Unique({ properties: ['user', 'school'] })
export class SchoolMember {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => School)
  school!: School;

  @Enum(() => SchoolRole)
  role!: SchoolRole;

  @Property({ default: true })
  isCreator: boolean = true;

  @Property({ onCreate: () => new Date(), defaultRaw: 'now()' })
  createdAt: Date = new Date();
}
