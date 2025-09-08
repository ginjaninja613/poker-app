// backend/src/routes/tournaments.js
const express = require('express');
const Tournament = require('../models/Tournament');
const Casino = require('../models/Casino');
const LiveTournamentState = require('../models/LiveTournamentState'); // <-- NEW
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const router = express.Router();

function ensureAssignedOrAdmin(req, casinoId) {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  const ids = Array.isArray(req.user.assignedCasinoIds)
    ? req.user.assignedCasinoIds.map(String)
    : [];
  return ids.includes(String(casinoId));
}

/**
 * STEP 1c –– Normalise incoming payload
 * - If reEntryUnlimited = true  -> reEntry = true and reEntryCount = 0
 * - If days[] exist             -> sort by startTimeUTC and set dateTimeUTC = earliest day
 * - Coerce obvious numeric fields to Numbers
 */
function normalizeTournamentPayload(body) {
  const data = { ...body };

  // Coerce simple numbers if they arrive as strings
  const numKeys = [
    'buyIn', 'rake', 'bounty', 'startingStack',
    'reEntryCount', 'lateRegLevels', 'prizePool' // <-- fixed key
  ];
  numKeys.forEach((k) => {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
      const n = Number(data[k]);
      if (!Number.isNaN(n)) data[k] = n;
    }
  });

  // Unlimited re-entry implies on + count = 0
  if (data.reEntryUnlimited) {
    data.reEntry = true;
    data.reEntryCount = 0;
  }

  // Normalise structure array if provided
  if (Array.isArray(data.structure)) {
    data.structure = data.structure.map((lv, idx) => {
      if (lv.isBreak) {
        return {
          level: 0,
          smallBlind: 0,
          bigBlind: 0,
          ante: 0,
          durationMinutes: Number(lv.durationMinutes ?? lv.duration ?? 0) || 0,
          isBreak: true,
        };
      }
      return {
        level: Number(lv.level ?? idx + 1),
        smallBlind: Number(lv.smallBlind || 0),
        bigBlind: Number(lv.bigBlind || 0),
        ante: Number(lv.ante || 0),
        durationMinutes: Number(lv.durationMinutes ?? lv.duration ?? 0) || 0,
        isBreak: false,
      };
    });
  } else {
    data.structure = [];
  }

  // Normalise multi-day info
  if (Array.isArray(data.days) && data.days.length > 0) {
    // keep only valid entries and coerce date + inner structure
    let days = data.days
      .filter((d) => d && d.startTimeUTC)
      .map((d) => {
        const start = new Date(d.startTimeUTC);
        const dayOut = { label: d.label || '', startTimeUTC: start };

        // Optional per-day structure
        if (Array.isArray(d.structure)) {
          dayOut.structure = d.structure.map((lv, idx) => {
            if (lv.isBreak) {
              return {
                level: 0,
                smallBlind: 0,
                bigBlind: 0,
                ante: 0,
                durationMinutes: Number(lv.durationMinutes ?? lv.duration ?? 0) || 0,
                isBreak: true,
              };
            }
            return {
              level: Number(lv.level ?? idx + 1),
              smallBlind: Number(lv.smallBlind || 0),
              bigBlind: Number(lv.bigBlind || 0),
              ante: Number(lv.ante || 0),
              durationMinutes: Number(lv.durationMinutes ?? lv.duration ?? 0) || 0,
              isBreak: false,
            };
          });
        } else {
          dayOut.structure = [];
        }

        return dayOut;
      })
      .sort((a, b) => new Date(a.startTimeUTC) - new Date(b.startTimeUTC));

    // ⬇️ Server-side guard: if root structure exists, copy to any empty day
    if (Array.isArray(data.structure) && data.structure.length > 0) {
      days = days.map((d) =>
        (Array.isArray(d.structure) && d.structure.length > 0) ? d : { ...d, structure: data.structure }
      );
    }

    data.days = days;

    // Set main start time to earliest day (compat with old clients)
    if (days.length > 0) {
      data.dateTimeUTC = days[0].startTimeUTC;
    }
  } else if (data.dateTimeUTC) {
    // Ensure dateTimeUTC is a Date object if provided directly
    data.dateTimeUTC = new Date(data.dateTimeUTC);
  }

  return data;
}

/**
 * Public: list tournaments with optional filters: casinoId, dateFrom, dateTo, status
 */
router.get('/', async (req, res) => {
  try {
    const { casinoId, dateFrom, dateTo, status } = req.query;
    const q = {};
    if (casinoId) q.casinoId = casinoId;
    if (status) q.status = status;
    if (dateFrom || dateTo) {
      q.dateTimeUTC = {};
      if (dateFrom) q.dateTimeUTC.$gte = new Date(dateFrom);
      if (dateTo) q.dateTimeUTC.$lte = new Date(dateTo);
    }
    const items = await Tournament.find(q).sort({ dateTimeUTC: 1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list tournaments' });
  }
});

/**
 * NEW: Get live tournament state (public, read-only)
 * Must be defined BEFORE '/:id' catch-all route.
 */
router.get('/:id/live', async (req, res) => {
  try {
    const live = await LiveTournamentState.findOne({ tournamentId: req.params.id }).lean();
    // If no live doc yet, return null so clients can show "Scheduled" if relevant
    res.json(live || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get live state' });
  }
});

/**
 * Public: get one tournament
 */
router.get('/:id', async (req, res) => {
  try {
    const item = await Tournament.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: 'Tournament not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tournament' });
  }
});

/**
 * Staff: create tournament
 */
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    // Normalise incoming body (STEP 1c)
    const data = normalizeTournamentPayload(req.body);

    if (!data.casinoId) return res.status(400).json({ error: 'casinoId is required' });
    if (!ensureAssignedOrAdmin(req, data.casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }

    const casino = await Casino.findById(data.casinoId).lean();
    if (!casino) return res.status(400).json({ error: 'Casino does not exist' });

    const created = await Tournament.create(data);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

/**
 * Staff: update tournament
 */
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const existing = await Tournament.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tournament not found' });
    if (!ensureAssignedOrAdmin(req, existing.casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }

    // Normalise incoming body (STEP 1c)
    const patch = normalizeTournamentPayload(req.body);

    const targetCasinoId = patch.casinoId ?? existing.casinoId;

    if (!ensureAssignedOrAdmin(req, targetCasinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }

    patch.casinoId = existing.casinoId;

    Object.assign(existing, patch); // partial update
    const saved = await existing.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

/**
 * Staff: delete tournament
 */
router.delete('/:id', auth, requireStaff, async (req, res) => {
  try {
    const existing = await Tournament.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tournament not found' });
    if (!ensureAssignedOrAdmin(req, existing.casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }
    await existing.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

/**
 * NEW: Upsert live tournament state (staff/admin assigned to casino)
 * Body: { status, dayIndex, levelIndex, remainingMs, totalLevels?, dayLabel? }
 */
router.patch('/:id/live', auth, requireStaff, async (req, res) => {
  try {
    // 1) Load the tournament for permission + casinoId
    const t = await Tournament.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: 'Tournament not found' });

    if (!ensureAssignedOrAdmin(req, t.casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }

    // 2) Sanitize input
    const allowedStatus = ['scheduled', 'running', 'paused', 'completed'];
    const status = allowedStatus.includes(req.body?.status) ? req.body.status : 'paused';

    const dayIndex = Math.max(0, Number(req.body?.dayIndex ?? 0) || 0);
    const levelIndex = Math.max(0, Number(req.body?.levelIndex ?? 0) || 0);
    const remainingMs = Math.max(0, Number(req.body?.remainingMs ?? 0) || 0);
    const totalLevels = Math.max(0, Number(req.body?.totalLevels ?? 0) || 0);
    const dayLabel = typeof req.body?.dayLabel === 'string' ? req.body.dayLabel : undefined;

    // 3) Upsert the live state
    const update = {
      tournamentId: t._id,
      casinoId: t.casinoId,
      status,
      dayIndex,
      levelIndex,
      remainingMs,
      totalLevels,
      updatedAt: new Date(),
    };
    if (dayLabel !== undefined) update.dayLabel = dayLabel;

    const saved = await LiveTournamentState.findOneAndUpdate(
      { tournamentId: t._id },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert live state' });
  }
});

module.exports = router;
