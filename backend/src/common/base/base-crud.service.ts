import { SearchQueryDto } from '../dto';
import { BaseRepository } from './base.repository';

export abstract class BaseCrudService<
  TEntity,
  TFindUniqueArgs,
  TFindFirstArgs,
  TFindManyArgs,
  TCreateArgs,
  TUpdateArgs,
  TDeleteArgs,
  TCountArgs,
  TRepository extends BaseRepository<
    TEntity,
    TFindUniqueArgs,
    TFindFirstArgs,
    TFindManyArgs,
    TCreateArgs,
    TUpdateArgs,
    TDeleteArgs,
    TCountArgs
  > = BaseRepository<
    TEntity,
    TFindUniqueArgs,
    TFindFirstArgs,
    TFindManyArgs,
    TCreateArgs,
    TUpdateArgs,
    TDeleteArgs,
    TCountArgs
  >,
> {
  protected constructor(protected readonly repository: TRepository) {}

  /* -------------------------------------------------------------------------- */
  /* Hooks                                                                       */
  /* -------------------------------------------------------------------------- */

  protected beforeCreate(_args: TCreateArgs): Promise<void> {
    void _args;
    return Promise.resolve();
  }

  protected afterCreate(_entity: TEntity): Promise<void> {
    void _entity;
    return Promise.resolve();
  }

  protected beforeUpdate(_args: TUpdateArgs): Promise<void> {
    void _args;
    return Promise.resolve();
  }

  protected afterUpdate(_entity: TEntity): Promise<void> {
    void _entity;
    return Promise.resolve();
  }

  protected beforeDelete(_args: TDeleteArgs): Promise<void> {
    void _args;
    return Promise.resolve();
  }

  protected afterDelete(_entity: TEntity): Promise<void> {
    void _entity;
    return Promise.resolve();
  }

  /* -------------------------------------------------------------------------- */
  /* CRUD                                                                        */
  /* -------------------------------------------------------------------------- */

  async findUnique(args: TFindUniqueArgs): Promise<TEntity | null> {
    return this.repository.findUnique(args);
  }

  async findFirst(args?: TFindFirstArgs): Promise<TEntity | null> {
    return this.repository.findFirst(args);
  }

  async findMany(args?: TFindManyArgs): Promise<TEntity[]> {
    return this.repository.findMany(args);
  }

  async create(args: TCreateArgs): Promise<TEntity> {
    await this.beforeCreate(args);

    const entity = await this.repository.create(args);

    await this.afterCreate(entity);

    return entity;
  }

  async update(args: TUpdateArgs): Promise<TEntity> {
    await this.beforeUpdate(args);

    const entity = await this.repository.update(args);

    await this.afterUpdate(entity);

    return entity;
  }

  async delete(args: TDeleteArgs): Promise<TEntity> {
    await this.beforeDelete(args);

    const entity = await this.repository.delete(args);

    await this.afterDelete(entity);

    return entity;
  }

  async count(args?: TCountArgs): Promise<number> {
    return this.repository.count(args);
  }

  async exists(args: TCountArgs): Promise<boolean> {
    return this.repository.exists(args);
  }

  /**
   * Feature services should override this
   * with module-specific pagination.
   */
  paginate(_query: SearchQueryDto): Promise<never> {
    void _query;
    throw new Error('paginate() must be implemented by the derived service.');
  }
}
