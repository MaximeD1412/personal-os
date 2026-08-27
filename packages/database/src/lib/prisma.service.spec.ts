import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it("n'expose pas les opérations SQL brutes aux modules métier", () => {
    expect(PrismaService.prototype).not.toHaveProperty('$queryRaw');
    expect(PrismaService.prototype).not.toHaveProperty('$executeRaw');
  });
});
