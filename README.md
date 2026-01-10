# 🏏 Cricket AR

A browser-based augmented reality cricket batting game using hand tracking.

## Features
- **Hand-controlled bat** - Your hand becomes the cricket bat via webcam
- **3D cricket field** - Realistic pitch, wickets, and boundary circles
- **Zone-based hitting** - Middle (power), Toe (low), Edge (deflection)
- **Authentic shots** - Cover Drive, Pull, Cut, and more using clock-face directions
- **Ball trajectory** - Dotted line shows where the ball travels

## How to Play
1. Open in browser (requires webcam)
2. Click "Bowl" to start
3. Swing your hand to hit the ball!

## 🏏 Shot Guide

### Speed Tiers
- **Block/Defensive**: Slow movement (Speed > 0.3)
- **Medium Shot**: Normal swing (Speed > 1.0)
- **Power Shot**: Fast swing (Speed > 2.0)

### Shot Directions
| Shot Name | Direction | Required Action |
|-----------|-----------|-----------------|
| **Straight Drive** | ⬆️ Up | Swing straight up towards the screen |
| **Cover Drive** | ↗️ Up-Right | Swing diagonally up and right |
| **Square Cut** | ➡️ Right | Swing horizontally to the right |
| **Pull Shot** | ↖️ Up-Left | Swing diagonally up and left |
| **On Drive** | ⬅️ Left | Swing horizontally to the left |
| **Late Cut** | ↘️ Down-Right | Swing diagonally down and right |
| **Flick** | ↙️ Down-Left | Swing diagonally down and left |
| **Block** | ⏺️ Center | Hold steady or move slowly forward |

## Tech Stack
Three.js • MediaPipe Hands • Cannon-es Physics
