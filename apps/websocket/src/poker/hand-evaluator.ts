import type { Card, HandRank, HandResult, Rank } from '@poker/types';

const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const HAND_RANKINGS: Record<HandRank, number> = {
  'high-card': 1,
  pair: 2,
  'two-pair': 3,
  'three-of-a-kind': 4,
  straight: 5,
  flush: 6,
  'full-house': 7,
  'four-of-a-kind': 8,
  'straight-flush': 9,
  'royal-flush': 10,
};

function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

function sortByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
}

function getCombinations(cards: Card[], k: number): Card[][] {
  const result: Card[][] = [];

  function combine(start: number, current: Card[]): void {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      current.push(cards[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return result;
}

function isFlush(cards: Card[]): boolean {
  const suit = cards[0].suit;
  return cards.every((card) => card.suit === suit);
}

function isStraight(cards: Card[]): boolean {
  const sorted = sortByRank(cards);
  const values = sorted.map((c) => getRankValue(c.rank));

  // Check for A-2-3-4-5 straight (wheel)
  if (
    values[0] === 14 &&
    values[1] === 5 &&
    values[2] === 4 &&
    values[3] === 3 &&
    values[4] === 2
  ) {
    return true;
  }

  // Check normal straight
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      return false;
    }
  }

  return true;
}

function getRankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

function evaluateFiveCards(cards: Card[]): { rank: HandRank; value: number; description: string } {
  if (cards.length !== 5) {
    throw new Error('Must evaluate exactly 5 cards');
  }

  const sorted = sortByRank(cards);
  const isFlushHand = isFlush(cards);
  const isStraightHand = isStraight(cards);
  const rankCounts = getRankCounts(cards);

  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const ranks = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return getRankValue(b[0]) - getRankValue(a[0]);
  });

  // Calculate base value for comparison
  let baseValue = 0;
  for (let i = 0; i < sorted.length; i++) {
    baseValue += getRankValue(sorted[i].rank) * Math.pow(15, 4 - i);
  }

  // Royal Flush
  if (
    isFlushHand &&
    isStraightHand &&
    getRankValue(sorted[0].rank) === 14 &&
    getRankValue(sorted[4].rank) === 10
  ) {
    return {
      rank: 'royal-flush',
      value: HAND_RANKINGS['royal-flush'] * 1000000000 + baseValue,
      description: 'Royal Flush',
    };
  }

  // Straight Flush
  if (isFlushHand && isStraightHand) {
    return {
      rank: 'straight-flush',
      value: HAND_RANKINGS['straight-flush'] * 1000000000 + baseValue,
      description: `Straight Flush, ${sorted[0].rank} high`,
    };
  }

  // Four of a Kind
  if (counts[0] === 4) {
    return {
      rank: 'four-of-a-kind',
      value: HAND_RANKINGS['four-of-a-kind'] * 1000000000 + getRankValue(ranks[0][0]) * 1000000,
      description: `Four of a Kind, ${ranks[0][0]}s`,
    };
  }

  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return {
      rank: 'full-house',
      value:
        HAND_RANKINGS['full-house'] * 1000000000 +
        getRankValue(ranks[0][0]) * 1000000 +
        getRankValue(ranks[1][0]) * 1000,
      description: `Full House, ${ranks[0][0]}s full of ${ranks[1][0]}s`,
    };
  }

  // Flush
  if (isFlushHand) {
    return {
      rank: 'flush',
      value: HAND_RANKINGS['flush'] * 1000000000 + baseValue,
      description: `Flush, ${sorted[0].rank} high`,
    };
  }

  // Straight
  if (isStraightHand) {
    // Handle wheel (A-2-3-4-5)
    const values = sorted.map((c) => getRankValue(c.rank));
    const highCard = values[0] === 14 && values[1] === 5 ? 5 : values[0];
    return {
      rank: 'straight',
      value: HAND_RANKINGS['straight'] * 1000000000 + highCard * 1000000,
      description: `Straight, ${highCard === 14 ? 'A' : highCard} high`,
    };
  }

  // Three of a Kind
  if (counts[0] === 3) {
    return {
      rank: 'three-of-a-kind',
      value: HAND_RANKINGS['three-of-a-kind'] * 1000000000 + getRankValue(ranks[0][0]) * 1000000,
      description: `Three of a Kind, ${ranks[0][0]}s`,
    };
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    return {
      rank: 'two-pair',
      value:
        HAND_RANKINGS['two-pair'] * 1000000000 +
        getRankValue(ranks[0][0]) * 1000000 +
        getRankValue(ranks[1][0]) * 1000 +
        getRankValue(ranks[2][0]),
      description: `Two Pair, ${ranks[0][0]}s and ${ranks[1][0]}s`,
    };
  }

  // Pair
  if (counts[0] === 2) {
    return {
      rank: 'pair',
      value: HAND_RANKINGS['pair'] * 1000000000 + getRankValue(ranks[0][0]) * 1000000,
      description: `Pair of ${ranks[0][0]}s`,
    };
  }

  // High Card
  return {
    rank: 'high-card',
    value: HAND_RANKINGS['high-card'] * 1000000000 + baseValue,
    description: `High Card, ${sorted[0].rank}`,
  };
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate');
  }

  // Get all 5-card combinations
  const combinations = getCombinations(allCards, 5);

  let bestResult = {
    rank: 'high-card' as HandRank,
    value: 0,
    description: '',
    cards: combinations[0],
  };

  for (const combo of combinations) {
    const result = evaluateFiveCards(combo);
    if (result.value > bestResult.value) {
      bestResult = {
        ...result,
        cards: combo,
      };
    }
  }

  return {
    userId: '', // Will be set by caller
    rank: bestResult.rank,
    rankValue: bestResult.value,
    cards: bestResult.cards,
    description: bestResult.description,
  };
}

export function compareHands(hand1: HandResult, hand2: HandResult): number {
  return hand1.rankValue - hand2.rankValue;
}
