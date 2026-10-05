import { NotFoundException } from '@nestjs/common';

export abstract class BaseRepository<
  TEntity,
  TFindUniqueArgs,
  TFindFirstArgs,
  TFindManyArgs,
  TCreateArgs,
  TUpdateArgs,
  TDeleteArgs,
  TCountArgs,
> {
  protected constructor(
    protected readonly delegate: {
      findUnique(args: TFindUniqueArgs): Promise<TEntity | null>;

      findFirst(args?: TFindFirstArgs): Promise<TEntity | null>;

      findMany(args?: TFindManyArgs): Promise<TEntity[]>;

      create(args: TCreateArgs): Promise<TEntity>;

      update(args: TUpdateArgs): Promise<TEntity>;

      delete(args: TDeleteArgs): Promise<TEntity>;

      count(args?: TCountArgs): Promise<number>;
    },

    protected readonly entityName: string,
  ) {}

  /**
   * Protected accessor for repositories.
   * Avoid exposing the internal delegate implementation.
   */
  protected get repository() {
    return this.delegate;
  }

  /**
   * Protected accessor for the entity name.
   */
  protected get entity() {
    return this.entityName;
  }

  async findUnique(args: TFindUniqueArgs): Promise<TEntity | null> {
    return this.repository.findUnique(args);
  }

  async findFirst(args?: TFindFirstArgs): Promise<TEntity | null> {
    return this.repository.findFirst(args);
  }

  async findMany(args?: TFindManyArgs): Promise<TEntity[]> {
    return this.repository.findMany(args);
  }

  async findUniqueOrThrow(args: TFindUniqueArgs): Promise<TEntity> {
    const entity = await this.findUnique(args);

    if (!entity) {
      throw new NotFoundException(`${this.entity} not found`);
    }

    return entity;
  }

  async create(args: TCreateArgs): Promise<TEntity> {
    return this.repository.create(args);
  }

  async update(args: TUpdateArgs): Promise<TEntity> {
    return this.repository.update(args);
  }

  async delete(args: TDeleteArgs): Promise<TEntity> {
    return this.repository.delete(args);
  }

  async count(args?: TCountArgs): Promise<number> {
    return this.repository.count(args);
  }

  async exists(args: TCountArgs): Promise<boolean> {
    return (await this.repository.count(args)) > 0;
  }
}
