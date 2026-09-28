import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

const ROOMS = [
  { sport: 'mlb', title: 'MLB Community', emoji: '\u26be', description: 'Baseball discussions, analysis and live reactions' },
  { sport: 'nfl', title: 'NFL Community', emoji: '\ud83c\udfc8', description: 'Football discussions, analysis and live reactions' },
  { sport: 'nba', title: 'NBA Community', emoji: '\ud83c\udfc0', description: 'Basketball discussions, analysis and live reactions' },
  { sport: 'wnba', title: 'WNBA Community', emoji: '\ud83c\udfc0', description: 'WNBA discussions, analysis and live reactions' },
  { sport: 'nhl', title: 'NHL Community', emoji: '\ud83c\udfd2', description: 'Hockey discussions, analysis and live reactions' },
  { sport: 'soccer', title: 'Soccer Community', emoji: '\u26bd', description: 'Football/soccer discussions and analysis' }
];

const REPORT_REASONS = new Set(['spam', 'harassment', 'hate_abuse', 'scam_fraud', 'misleading', 'threats', 'sexual_inappropriate', 'other']);
const REACTIONS = new Set(['\uD83D\uDE02','\uD83E\uDD23','\uD83D\uDC80','\uD83D\uDE2D','\uD83D\uDD25','\uD83D\uDC40','\uD83E\uDD2F','\uD83E\uDD21','\uD83D\uDDFF','\uD83D\uDE2E','\u2764\uFE0F','\uD83D\uDCAF','\uD83D\uDE80','\uD83E\uDEE1','\uD83E\uDDE2','\u26BE','\uD83C\uDFC8','\uD83C\uDFC0','\uD83C\uDFD2','\u26BD','\uD83C\uDFC6','\uD83D\uDC4F','\uD83D\uDE4F','\uD83D\uDE08','W','L','COOKED','COOKING','CAP','NO CAP','LOCK']);

function cleanSport(sport) {
  const id = String(sport || '').toLowerCase();
  return ROOMS.some(r => r.sport === id) ? id : null;
}

function cleanText(text, max = 1800) {
  const out = String(text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return out.slice(0, max);
}

function publicUser(user) {
  if (!user) return { id: null, name: 'CovrIQ Member', avatar_url: null, created_at: null, reputation: 0 };
  return {
    id: user.id,
    name: user.name || (user.email ? user.email.split('@')[0] : 'CovrIQ Member'),
    avatar_url: user.avatar_url || null,
    created_at: user.created_at,
    reputation: user.reputation || 0
  };
}

function quotePayload(source) {
  if (!source) return null;
  return {
    id: source.id,
    type: source.type || 'post',
    user: source.user ? publicUser(source.user) : null,
    content: cleanText(source.content, 220)
  };
}

async function ensureRooms() {
  const rooms = [];
  for (const room of ROOMS) {
    const saved = await prisma.communityRoom.upsert({
      where: { sport: room.sport },
      update: { title: room.title, description: room.description, emoji: room.emoji },
      create: room
    });
    rooms.push(saved);
  }
  return rooms;
}
async function blockedIdsFor(userId) {
  if (!userId) return new Set();
  const blocks = await prisma.communityBlock.findMany({ where: { blocker_id: userId } });
  return new Set(blocks.map(b => b.blocked_user_id));
}

async function decoratePost(post, viewerId = null, commentRows = null) {
  const [votes, reactions, comments] = await Promise.all([
    prisma.communityVote.findMany({ where: { post_id: post.id } }),
    prisma.communityReaction.findMany({ where: { post_id: post.id } }),
    commentRows ? Promise.resolve(commentRows.filter(c => c.post_id === post.id)) : prisma.communityComment.findMany({ where: { post_id: post.id } })
  ]);
  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.reaction] ||= { reaction: r.reaction, count: 0, reacted: false };
    acc[r.reaction].count += 1;
    if (viewerId && r.user_id === viewerId) acc[r.reaction].reacted = true;
    return acc;
  }, {});
  return {
    ...post,
    user: publicUser(post.user),
    score: votes.reduce((sum, v) => sum + Number(v.value || 0), 0),
    viewerVote: viewerId ? (votes.find(v => v.user_id === viewerId)?.value || 0) : 0,
    replyCount: comments.filter(c => !c.is_deleted).length,
    reactions: Object.values(reactionCounts),
    quote: post.quote || null
  };
}

async function decorateComment(comment, viewerId = null) {
  const [votes, reactions] = await Promise.all([
    prisma.communityVote.findMany({ where: { comment_id: comment.id } }),
    prisma.communityReaction.findMany({ where: { comment_id: comment.id } })
  ]);
  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.reaction] ||= { reaction: r.reaction, count: 0, reacted: false };
    acc[r.reaction].count += 1;
    if (viewerId && r.user_id === viewerId) acc[r.reaction].reacted = true;
    return acc;
  }, {});
  return {
    ...comment,
    user: publicUser(comment.user),
    score: votes.reduce((sum, v) => sum + Number(v.value || 0), 0),
    viewerVote: viewerId ? (votes.find(v => v.user_id === viewerId)?.value || 0) : 0,
    reactions: Object.values(reactionCounts),
    quote: comment.quote || null
  };
}

function sortPosts(posts, sort) {
  const now = Date.now();
  const withHot = posts.map(p => {
    const ageHours = Math.max(1, (now - new Date(p.created_at).getTime()) / 36e5);
    return { ...p, hotScore: (p.score * 2 + p.replyCount * 1.5 + (p.reactions || []).reduce((s, r) => s + r.count, 0)) / Math.pow(ageHours + 2, 0.55) };
  });
  if (sort === 'new') return withHot.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === 'top') return withHot.sort((a, b) => (b.score - a.score) || (b.replyCount - a.replyCount));
  if (sort === 'discussed') return withHot.sort((a, b) => (b.replyCount - a.replyCount) || (b.score - a.score));
  return withHot.sort((a, b) => b.hotScore - a.hotScore);
}

router.get('/rooms', optionalAuth, async (req, res) => {
  try {
    const rooms = await ensureRooms();
    res.json({ rooms: rooms.map(r => ({ sport: r.sport, title: r.title, emoji: r.emoji, description: r.description })) });
  } catch (error) {
    console.error('[Community] rooms error:', error);
    res.status(500).json({ error: "Couldn't load the community. Try again." });
  }
});

router.get('/rooms/:sport/posts', optionalAuth, async (req, res) => {
  try {
    const sport = cleanSport(req.params.sport);
    if (!sport) return res.status(404).json({ error: 'Community not found.' });
    await ensureRooms();
    const blocked = await blockedIdsFor(req.user?.id);
    const allComments = await prisma.communityComment.findMany({ where: { sport } });
    const rows = await prisma.communityPost.findMany({ where: { sport }, include: { user: true } });
    const query = String(req.query.q || '').toLowerCase().trim();
    const visible = rows.filter(p => !blocked.has(p.user_id) && !p.is_deleted && (!query || p.content.toLowerCase().includes(query) || publicUser(p.user).name.toLowerCase().includes(query)));
    const decorated = await Promise.all(visible.map(p => decoratePost(p, req.user?.id, allComments)));
    res.json({ posts: sortPosts(decorated, String(req.query.sort || 'hot')) });
  } catch (error) {
    console.error('[Community] feed error:', error);
    res.status(500).json({ error: "Couldn't load the community. Try again." });
  }
});

router.post('/rooms/:sport/posts', requireAuth, async (req, res) => {
  try {
    const sport = cleanSport(req.params.sport);
    const content = cleanText(req.body.content, 60000);
    if (!sport) return res.status(404).json({ error: 'Community not found.' });
    if (content.length < 2) return res.status(400).json({ error: 'Write a little more before posting.' });
    const room = (await ensureRooms()).find(r => r.sport === sport);
    const post = await prisma.communityPost.create({ data: { room_id: room.id, user_id: req.user.id, sport, content, quote: req.body.quote || null }, include: { user: true } });
    res.status(201).json({ post: await decoratePost(post, req.user.id) });
  } catch (error) {
    console.error('[Community] create post error:', error);
    res.status(500).json({ error: "Your post couldn't be published. Please try again." });
  }
});

router.patch('/posts/:id', requireAuth, async (req, res) => {
  const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
  if (!post || post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts.' });
  const content = cleanText(req.body.content, 60000);
  if (content.length < 2) return res.status(400).json({ error: 'Post cannot be empty.' });
  const updated = await prisma.communityPost.update({ where: { id: post.id }, data: { content } });
  res.json({ post: updated });
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
  const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
  if (!post || post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });
  await prisma.communityPost.update({ where: { id: post.id }, data: { is_deleted: true, content: '[deleted]' } });
  res.json({ success: true });
});

router.get('/posts/:id/thread', optionalAuth, async (req, res) => {
  try {
    const post = await prisma.communityPost.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!post || post.is_deleted) return res.status(404).json({ error: 'Thread not found.' });
    const blocked = await blockedIdsFor(req.user?.id);
    if (blocked.has(post.user_id)) return res.status(404).json({ error: 'Thread not found.' });
    const comments = await prisma.communityComment.findMany({ where: { post_id: post.id }, include: { user: true } });
    const visible = comments.filter(c => !c.is_deleted && !blocked.has(c.user_id));
    res.json({ post: await decoratePost(post, req.user?.id, visible), comments: await Promise.all(visible.map(c => decorateComment(c, req.user?.id))) });
  } catch (error) {
    console.error('[Community] thread error:', error);
    res.status(500).json({ error: "Couldn't load the thread. Try again." });
  }
});

router.post('/posts/:id/comments', requireAuth, async (req, res) => {
  const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
  if (!post || post.is_deleted) return res.status(404).json({ error: 'Post not found.' });
  const content = cleanText(req.body.content, 60000);
  if (content.length < 2) return res.status(400).json({ error: 'Reply cannot be empty.' });
  const parentId = req.body.parentId || null;
  const comment = await prisma.communityComment.create({ data: { post_id: post.id, parent_id: parentId, user_id: req.user.id, sport: post.sport, content, quote: req.body.quote || null }, include: { user: true } });
  res.status(201).json({ comment: await decorateComment(comment, req.user.id) });
});

router.patch('/comments/:id', requireAuth, async (req, res) => {
  const comment = await prisma.communityComment.findUnique({ where: { id: req.params.id } });
  if (!comment || comment.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own replies.' });
  const content = cleanText(req.body.content, 60000);
  if (content.length < 2) return res.status(400).json({ error: 'Reply cannot be empty.' });
  const updated = await prisma.communityComment.update({ where: { id: comment.id }, data: { content } });
  res.json({ comment: updated });
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  const comment = await prisma.communityComment.findUnique({ where: { id: req.params.id } });
  if (!comment || comment.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own replies.' });
  await prisma.communityComment.update({ where: { id: comment.id }, data: { is_deleted: true, content: '[deleted]' } });
  res.json({ success: true });
});

router.post('/:type(posts|comments)/:id/vote', requireAuth, async (req, res) => {
  const value = Number(req.body.value);
  if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'Invalid vote.' });
  const key = req.params.type === 'posts' ? { post_id: req.params.id } : { comment_id: req.params.id };
  const existing = await prisma.communityVote.findFirst({ where: { user_id: req.user.id, ...key } });
  if (existing && value === 0) await prisma.communityVote.delete({ where: { id: existing.id } });
  else if (existing) await prisma.communityVote.update({ where: { id: existing.id }, data: { value } });
  else if (value !== 0) await prisma.communityVote.create({ data: { user_id: req.user.id, value, ...key } });
  res.json({ success: true });
});

router.post('/:type(posts|comments)/:id/reactions', requireAuth, async (req, res) => {
  const reaction = String(req.body.reaction || '').trim();
  if (!REACTIONS.has(reaction)) return res.status(400).json({ error: 'Reaction is not available.' });
  const key = req.params.type === 'posts' ? { post_id: req.params.id } : { comment_id: req.params.id };
  const existing = await prisma.communityReaction.findFirst({ where: { user_id: req.user.id, reaction, ...key } });
  if (existing) await prisma.communityReaction.delete({ where: { id: existing.id } });
  else await prisma.communityReaction.create({ data: { user_id: req.user.id, reaction, ...key } });
  res.json({ success: true });
});

router.post('/:type(posts|comments)/:id/report', requireAuth, async (req, res) => {
  const reason = String(req.body.reason || 'other');
  if (!REPORT_REASONS.has(reason)) return res.status(400).json({ error: 'Choose a valid report reason.' });
  const isPost = req.params.type === 'posts';
  const item = isPost ? await prisma.communityPost.findUnique({ where: { id: req.params.id } }) : await prisma.communityComment.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Content not found.' });
  const key = isPost ? { post_id: item.id } : { comment_id: item.id };
  const existing = await prisma.communityReport.findFirst({ where: { reporter_id: req.user.id, ...key } });
  if (existing) return res.status(409).json({ error: 'You already reported this content.' });
  const report = await prisma.communityReport.create({ data: { reporter_id: req.user.id, reported_user_id: item.user_id, reason, details: cleanText(req.body.details, 500), ...key } });
  res.status(201).json({ report, status: 'flagged_for_review' });
});

router.post('/users/:id/block', requireAuth, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot block yourself.' });
  await prisma.communityBlock.create({ data: { blocker_id: req.user.id, blocked_user_id: req.params.id } });
  res.json({ success: true });
});

router.delete('/users/:id/block', requireAuth, async (req, res) => {
  await prisma.communityBlock.deleteMany({ where: { blocker_id: req.user.id, blocked_user_id: req.params.id } });
  res.json({ success: true });
});

router.get('/users/search', requireAuth, async (req, res) => {
  const q = cleanText(req.query.q, 40).toLowerCase();
  if (!q) return res.json({ users: [] });
  const users = await prisma.user.findMany({ take: 8 });
  res.json({ users: users.filter(u => publicUser(u).name.toLowerCase().includes(q)).slice(0, 8).map(publicUser) });
});

router.get('/users/:id/profile', optionalAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const [posts, comments] = await Promise.all([
    prisma.communityPost.findMany({ where: { user_id: user.id } }),
    prisma.communityComment.findMany({ where: { user_id: user.id } })
  ]);
  res.json({ profile: { ...publicUser(user), posts: posts.length, replies: comments.length } });
});

export default router;


