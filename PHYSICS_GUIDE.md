# Cricket AR - Physics & Scoring Guide

## 🎯 Collision Detection

### How It Works
Every frame, the game calculates 3D distance between ball and bat:
```javascript
distance = √(dx² + dy² + dz²)
if (distance < 1.2m) → HIT!
```

### Current Values
| Parameter | Value |
|-----------|-------|
| Collision Threshold | 1.2m |
| Bat Z Position | 8.0 (fixed) |
| Wickets Z Position | 10.0 |

---

## ⚡ Force Calculation

### Formula
```
Total Force = Bat Force + Bowl Contribution

Bat Force = BaseForce × SpeedFactor × ZoneMultiplier
          = 10 × SpeedFactor × Zone

Bowl Contribution = BowlSpeed × 0.25 × ZoneMultiplier
```

### Bat Speed → SpeedFactor
| Bat Speed | Category | Factor |
|-----------|----------|--------|
| 0-3 m/s | Block | 0.2 |
| 3-6 m/s | Placement | 0.5 |
| 6-10 m/s | Attacking | 0.8 |
| 10-15 m/s | Power | 1.0 |
| 15+ m/s | Maximum | 1.2 |

### Zone Multiplier (Hit Location)
| Zone | Multiplier |
|------|------------|
| Handle | 0.10 |
| Shoulder | 0.30 |
| **Middle** | **1.00** |
| Lower | 0.70 |
| Toe | 0.40 |
| Edges | 0.40 |

---

## 🏏 Launch Angles

| Shot Type | Angle |
|-----------|-------|
| Forward Defensive | 8° |
| Late Cut | 20° |
| Cover/On Drive | 22° |
| Straight Drive | 25° |
| Square Cut/Flick | 28° |
| Pull Shot | 35° |

---

## 🔄 Bounce Physics

| Bounce # | Vertical | Horizontal |
|----------|----------|------------|
| 1st | 60% | 92% |
| 2nd | 50% | 85% |
| 3rd | 40% | 75% |
| 4th+ | 30% | 65% |

**Rolling Friction**: 2 m/s² after 3+ bounces

---

## 📊 Scoring System

**BOUNDARY LINE: 65m**

| Distance | Runs | Description |
|----------|------|-------------|
| 0-10m | **0** | Dot ball - fielder pounces |
| 10-25m | **1** | Quick single |
| 25-45m | **2** | Good placement |
| 45-60m | **3** | Running hard |
| 60-65m | **4** | Boundary (after bounce) |
| 65m+ | **6** | SIX! Over the rope |

> **Note:** If ball reaches 60-65m without bouncing, it's still a SIX!

---

## 🔥 Example Calculations

### Hitting a SIX
```
Bat Speed: 18 m/s → SpeedFactor = 1.2
Zone: Middle-Center → Zone = 1.0
Bowl Speed: 40 m/s (144 km/h)

Bat Force = 10 × 1.2 × 1.0 = 12
Bowl Contribution = 40 × 0.25 × 1.0 = 10
Total = 22 → Distance 65m+ → SIX!
```

### Defensive Block
```
Bat Speed: 2 m/s → SpeedFactor = 0.2
Zone: Middle → Zone = 1.0
Bowl Speed: 30 m/s

Bat Force = 10 × 0.2 × 1.0 = 2
Bowl Contribution = 30 × 0.25 × 1.0 = 7.5
Total = 9.5 → Distance ~15m → DOT BALL
```

### Edge to Boundary
```
Bat Speed: 15 m/s → SpeedFactor = 1.2
Zone: Edge → Zone = 0.4
Bowl Speed: 40 m/s

Bat Force = 10 × 1.2 × 0.4 = 4.8
Bowl Contribution = 40 × 0.25 × 0.4 = 4
Total = 8.8 → Distance ~25m → 2 RUNS
```

---

## 🎮 Tips for High Scores

1. **Swing fast** (15+ m/s) for SpeedFactor 1.2
2. **Hit middle-center** for Zone 1.0
3. **Face fast bowling** (40+ m/s) for +10 contribution
4. **Use drives** (22-25° angle) for maximum distance

**Maximum Possible Force**: ~23 (enough for 70m+ SIX)
