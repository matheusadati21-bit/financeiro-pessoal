import { PrismaClient } from '@prisma/client';

export const ensureDefaultData = async (prisma: PrismaClient) => {
  const count = await prisma.expenseCategory.count();
  if (count > 0) return;

  await prisma.expenseCategory.createMany({
    data: [
      { name: 'Moradia', color: '#2563eb', icon: 'Home' },
      { name: 'Alimentação', color: '#f97316', icon: 'Utensils' },
      { name: 'Transporte', color: '#16a34a', icon: 'Car' },
      { name: 'Saúde', color: '#dc2626', icon: 'HeartPulse' },
      { name: 'Lazer', color: '#7c3aed', icon: 'Sparkles' },
      { name: 'Assinaturas', color: '#0891b2', icon: 'CreditCard' },
      { name: 'Educação', color: '#ca8a04', icon: 'BookOpen' },
      { name: 'Outros', color: '#64748b', icon: 'MoreHorizontal' }
    ]
  });
};
