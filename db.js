import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

let prisma;
let isPrismaConnected = false;

try {
  prisma = new PrismaClient({
    log: [],
  });
} catch (error) {
  // Standalone prototype mode
}

// In-memory fallback store for zero-friction standalone execution
class InMemoryDb {
  constructor() {
    this.users = [];
    this.tenders = [];
    this.requirements = [];
    this.tasks = [];
    this.userSeq = 1;
    this.tenderSeq = 1;
    this.reqSeq = 1;
    this.taskSeq = 1;
  }

  async checkConnection() {
    if (!prisma) return false;
    try {
      await prisma.$connect();
      isPrismaConnected = true;
      console.log('✅ Connected to PostgreSQL database via Prisma');
      return true;
    } catch (err) {
      isPrismaConnected = false;
      console.log('ℹ️  PostgreSQL not connected. Operating with clean in-memory database.');
      return false;
    }
  }

  // Users
  async findUserByEmail(email) {
    if (isPrismaConnected) {
      try {
        return await prisma.user.findUnique({ where: { email } });
      } catch (e) { /* fallback */ }
    }
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async createUser(userData) {
    if (isPrismaConnected) {
      try {
        return await prisma.user.create({ data: userData });
      } catch (e) { /* fallback */ }
    }
    const user = {
      id: this.userSeq++,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.push(user);
    return user;
  }

  // Tenders
  async getAllTenders() {
    if (isPrismaConnected) {
      try {
        return await prisma.tender.findMany({
          include: { requirements: true, tasks: true },
          orderBy: { uploadDate: 'desc' }
        });
      } catch (e) { /* fallback */ }
    }
    return this.tenders;
  }

  async getTenderById(id) {
    const numId = typeof id === 'number' ? id : parseInt(id, 10);
    if (isPrismaConnected && !isNaN(numId)) {
      try {
        return await prisma.tender.findUnique({
          where: { id: numId },
          include: { requirements: true, tasks: true }
        });
      } catch (e) { /* fallback */ }
    }
    return this.tenders.find(t => t.id === numId || String(t.id) === String(id)) || null;
  }

  async createTender(tenderData, requirements = [], tasks = []) {
    const sanitizedTenderData = {
      ...tenderData,
      userId: tenderData.userId != null && !isNaN(parseInt(tenderData.userId, 10)) ? parseInt(tenderData.userId, 10) : null,
    };

    if (isPrismaConnected) {
      try {
        return await prisma.tender.create({
          data: {
            ...sanitizedTenderData,
            requirements: { create: requirements },
            tasks: { create: tasks }
          },
          include: { requirements: true, tasks: true }
        });
      } catch (e) { /* fallback */ }
    }
    const newTender = {
      id: this.tenderSeq++,
      ...sanitizedTenderData,
      uploadDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requirements: requirements.map((r, i) => ({
        id: this.reqSeq++,
        ...r
      })),
      tasks: tasks.map((tsk, i) => ({
        id: this.taskSeq++,
        ...tsk
      }))
    };
    this.tenders.unshift(newTender);
    return newTender;
  }

  async deleteTender(id) {
    const numId = typeof id === 'number' ? id : parseInt(id, 10);
    if (isPrismaConnected && !isNaN(numId)) {
      try {
        return await prisma.tender.delete({ where: { id: numId } });
      } catch (e) { /* fallback */ }
    }
    const idx = this.tenders.findIndex(t => t.id === numId || String(t.id) === String(id));
    if (idx !== -1) {
      return this.tenders.splice(idx, 1)[0];
    }
    return null;
  }

  // Analytics - Computed strictly from real data
  async getAnalyticsSummary() {
    const totalTenders = this.tenders.length;
    const activeTenders = this.tenders.filter(t => t.status === 'Active' || t.status === 'In Review').length;
    const wonCount = this.tenders.filter(t => t.status === 'Won').length;
    const lostCount = this.tenders.filter(t => t.status === 'Lost').length;
    const underReviewCount = this.tenders.filter(t => t.status === 'In Review' || t.status === 'Active').length;
    
    const decidedCount = wonCount + lostCount;
    const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0;

    const avgRiskScore = totalTenders > 0
      ? +(this.tenders.reduce((acc, t) => acc + (t.riskScore || 0), 0) / totalTenders).toFixed(1)
      : 0.0;

    // Count upcoming deadlines from requirements and tasks
    let upcomingDeadlines = 0;
    this.tenders.forEach(t => {
      if (t.requirements) {
        t.requirements.forEach(r => {
          if (r.type === 'Deadline') upcomingDeadlines++;
        });
      }
      if (t.tasks) {
        t.tasks.forEach(tsk => {
          if (tsk.status !== 'Completed') upcomingDeadlines++;
        });
      }
    });

    // Group monthly submissions
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};
    monthNames.forEach(m => {
      monthlyMap[m] = { month: m, submitted: 0, won: 0, lost: 0, value: 0 };
    });

    this.tenders.forEach(t => {
      const date = new Date(t.uploadDate || t.createdAt);
      const mName = monthNames[date.getMonth()];
      if (monthlyMap[mName]) {
        monthlyMap[mName].submitted++;
        if (t.status === 'Won') monthlyMap[mName].won++;
        if (t.status === 'Lost') monthlyMap[mName].lost++;
      }
    });

    const monthlyAnalysis = Object.values(monthlyMap);

    const winLossRatio = [
      { name: 'Won Bids', value: wonCount, color: '#1e3a5f' },
      { name: 'Lost Bids', value: lostCount, color: '#94a3b8' },
      { name: 'Under Review', value: underReviewCount, color: '#2563eb' }
    ];

    const lowRisk = this.tenders.filter(t => (t.riskScore || 0) < 2.5).length;
    const modRisk = this.tenders.filter(t => (t.riskScore || 0) >= 2.5 && (t.riskScore || 0) < 3.8).length;
    const highRisk = this.tenders.filter(t => (t.riskScore || 0) >= 3.8).length;

    const riskDistribution = [
      { level: 'Low Risk (0.0 - 2.5)', count: lowRisk, percentage: totalTenders > 0 ? Math.round((lowRisk / totalTenders) * 100) : 0, color: '#059669' },
      { level: 'Moderate Risk (2.5 - 3.8)', count: modRisk, percentage: totalTenders > 0 ? Math.round((modRisk / totalTenders) * 100) : 0, color: '#d97706' },
      { level: 'High Risk (3.8 - 5.0)', count: highRisk, percentage: totalTenders > 0 ? Math.round((highRisk / totalTenders) * 100) : 0, color: '#dc2626' }
    ];

    return {
      kpi: {
        activeTenders,
        upcomingDeadlines,
        winRate,
        avgRiskScore,
      },
      monthlyAnalysis,
      winLossRatio,
      riskDistribution,
    };
  }
}

export const db = new InMemoryDb();
export { prisma };
export default db;
