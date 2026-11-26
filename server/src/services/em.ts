import { EntityManager, RequestContext } from '@mikro-orm/postgresql';
import { orm } from '../index';

export const getEm = (): EntityManager => {
  const contextEm = RequestContext.getEntityManager() as
    | EntityManager
    | undefined;
  if (contextEm) {
    return contextEm;
  }
  if (!orm) {
    throw new Error('MikroORM instance is not initialized');
  }
  return orm.em.fork();
};
