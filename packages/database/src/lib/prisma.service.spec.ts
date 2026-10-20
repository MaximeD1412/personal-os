import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it("n'expose pas les opérations SQL brutes aux modules métier", () => {
    expect(PrismaService.prototype).not.toHaveProperty('$queryRaw');
    expect(PrismaService.prototype).not.toHaveProperty('$executeRaw');
  });

  it("n'ouvre une transaction qu'en lot : la forme interactive rendrait un client nu", () => {
    const service = Object.create(PrismaService.prototype) as PrismaService;
    const interactive = (() => Promise.resolve()) as unknown as [];

    expect(() => service.$transaction(interactive)).toThrow(
      "Une transaction ne s'ouvre qu'en lot d'opérations.",
    );
  });
});
