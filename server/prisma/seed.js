import prisma from '../src/db.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding CovrIQ database...');

  const password_hash = await bcrypt.hash('covriq123!', 10);

  const demoUser = await prisma.user.upsert({
    where: { email: 'pro@covriq.ai' },
    update: {},
    create: {
      email: 'pro@covriq.ai',
      password_hash,
      name: 'Sharps Handicapper',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      preference: {
        create: {
          theme: 'dark',
          odds_format: 'both',
          chat_font: 'serif',
          selected_sport: 'mlb',
          selected_league: null
        }
      }
    }
  });

  console.log(`Demo user created: ${demoUser.email} (Password: covriq123!)`);

  // Sample conversation
  const conv = await prisma.conversation.create({
    data: {
      user_id: demoUser.id,
      title: 'Yankees @ Red Sox Pitching Value',
      sport: 'mlb',
      league: null,
      messages: {
        create: [
          {
            role: 'user',
            content: 'Analyze tonight\'s Yankees vs Red Sox matchup at Fenway. Find the best market value on the moneyline or run line.',
            model: 'user_input'
          },
          {
            role: 'assistant',
            content: `### [GAME_HEADER]
- Sport: MLB
- Matchup: New York Yankees @ Boston Red Sox
- Event Time: Today • 7:10 PM ET
- League / Tournament: MLB Regular Season

### [MARKET_CARD]
- Recommended Market: Moneyline
- Target Pick: New York Yankees Moneyline
- Best Available Odds: +125
- Decimal Odds: 2.25
- Market Implied Probability: 44.44%
- AI Model Win Probability: 52.50%
- Estimated Betting Edge: +8.06%
- Expected Value (EV): +18.13%

### [WHY_I_LIKE_IT]
- **Starting Pitching Mismatch**: Gerrit Cole holds a 2.45 ERA with a 31.2% strikeout rate across his last 4 Fenway starts.
- **Bullpen Rest Advantage**: Boston's high-leverage bullpen arms pitched in back-to-back extra-inning contests.
- **Platoon Splits**: Yankees top 4 hitters boast a collective .884 OPS against left-handed pitchers over the past 30 days.

### [MATCHUP_AND_CURRENT_INFO]
- **Starting Confirmations**: NYY: Gerrit Cole (RHP, 3.12 ERA) vs BOS: Brayan Bello (RHP, 4.05 ERA).
- **Injuries**: Boston outfield depth is currently shorthanded due to a hamstring strain.
- **Weather Conditions**: 72°F at Fenway Park, mild 6mph wind blowing out to right-center.
- **Recent Form**: Yankees are 8-2 over their last 10 games, averaging 5.8 runs per game.

### [VALUE_AND_CONTRARIAN_ANALYSIS]
Public ticket volume is 64% on the home Red Sox, artificially depressing the Yankees moneyline price to +125. Our model projects true probability at 52.5%, creating an 8.06% edge over the market implied number.

### [RISKS_AND_WHY_NOT_TO_BET]
- Fenway Park's Green Monster introduces higher home run variance for pull-heavy righties.
- Umpire crew tonight favors low strike zones, potentially working against Cole's high fastball strategy.

### [FINAL_VERDICT]
- Verdict: BET
- Confidence Score: 8.5/10
- Recommended Unit Size: 1.0 Unit
- Summary: High-value underdog position with ace pitching leverage and bullpen depth. Take NYY at +120 or better.

### [SOURCES]
- https://www.mlb.com/probable-pitchers
- https://www.rotowire.com/baseball/injury-report.php
- https://www.actionnetwork.com/mlb/odds
`,
            model: 'gpt-5.6',
            metadata: {
              gameHeader: {
                sport: 'MLB',
                matchup: 'New York Yankees @ Boston Red Sox',
                time: 'Today • 7:10 PM ET',
                league: 'MLB Regular Season'
              },
              marketCard: {
                market: 'Moneyline',
                pick: 'New York Yankees Moneyline',
                americanOdds: '+125',
                decimalOdds: 2.25,
                impliedProb: 44.44,
                aiEstimatedProb: 52.5,
                edge: '+8.06%',
                expectedValue: '+18.13%'
              },
              verdict: {
                type: 'BET',
                confidence: 8.5,
                unitSize: '1.0 Unit',
                summary: 'High-value underdog position with ace pitching leverage.'
              }
            }
          }
        ]
      }
    }
  });

  console.log(`Sample conversation seeded: ${conv.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
