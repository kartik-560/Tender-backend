import db from '../db.js';

/**
 * Returns summary KPI analytics and Recharts data payloads
 */
export async function getAnalytics(req, res, next) {
  try {
    const analytics = await db.getAnalyticsSummary();
    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
}

export default { getAnalytics };
