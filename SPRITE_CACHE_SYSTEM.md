# Roulette Sprite Caching System

## Overview

The Sprite Caching System is a comprehensive, production-ready solution for managing and rendering roulette wheel assets in the BUSSDOWNROLLIE project. It provides efficient sprite generation, caching, and memory management capabilities using node-canvas.

## Features

### 🎨 **Advanced Sprite Generation**
- **Wheel Base**: Metallic bevel effects with gradient shading
- **Numbers Overlay**: High-contrast text rendering with shadows
- **Pocket Mask**: Binary mask for ball landing detection
- **Ball Sprite**: 3D-styled with specular highlights
- **Pocket Colors**: Color-coded visualization

### 🚀 **Performance Optimizations**
- **Lazy Loading**: Sprites generated on-demand
- **Memory Caching**: In-memory sprite storage with size tracking
- **Cache Statistics**: Hit/miss tracking and performance monitoring
- **Preloading**: Essential sprite pre-loading for smooth animations

### 🧠 **Smart Memory Management**
- **Volatile vs. Permanent**: Configurable sprite lifecycle
- **Automatic Cleanup**: Cache clearing with size management
- **Memory Monitoring**: Real-time usage tracking
- **Health Diagnostics**: Cache validation and status reporting

### 📊 **Monitoring & Analytics**
- **Cache Hit Rates**: Performance metrics
- **Memory Usage**: Size tracking by sprite
- **Health Status**: System health monitoring
- **Validation**: Cache integrity checks

## API Reference

### Core Functions

#### `initializeSpriteCache()`
Initializes the sprite cache system and creates necessary directories.

```javascript
import { initializeSpriteCache } from './roulette/sprites.js';

await initializeSpriteCache();
```

#### `getSprite(key)`
Retrieves a cached sprite or generates it if not cached.

```javascript
import { getSprite } from './roulette/sprites.js';

// Get wheel base
const wheelBase = await getSprite('wheelBase');

// Get ball sprite
const ball = await getSprite('ball');

// Get numbers overlay
const numbers = await getSprite('numbersOverlay');
```

#### `getCacheStats()`
Returns current cache statistics including hit rates and memory usage.

```javascript
import { getCacheStats } from './roulette/sprites.js';

const stats = getCacheStats();
console.log({
  hits: stats.hits,
  misses: stats.misses,
  hitRate: stats.hitRate,
  cacheSize: stats.cacheSize
});
```

#### `clearCache()`
Clears all cached sprites from memory.

```javascript
import { clearCache } from './roulette/sprites.js';

clearCache();
```

#### `clearVolatile()`
Clears only volatile sprites (ball sprites, temporary assets).

```javascript
import { clearVolatile } from './roulette/sprites.js';

const cleared = clearVolatile();
console.log(`Cleared ${cleared} volatile sprites`);
```

#### `preloadEssentialSprites()`
Preloads essential sprites for optimal performance.

```javascript
import { preloadEssentialSprites } from './roulette/sprites.js';

await preloadEssentialSprites();
```

### Sprite Keys

The system supports the following sprite types:

| Key | Description | Dimensions | Volatile |
|-----|-------------|------------|----------|
| `wheelBase` | Main wheel with metallic rim | 600x600 | No |
| `numbersOverlay` | Number text overlay | 600x600 | No |
| `pocketMask` | Binary mask for collision detection | 600x600 | No |
| `ball` | Ball sprite with highlights | 40x40 | Yes |
| `pocketColors` | Color visualization | 600x600 | No |

### Advanced Features

#### Health Monitoring

```javascript
import { getSpriteCache } from './roulette/sprites.js';

const cache = getSpriteCache();
const health = cache.getHealthStatus();

if (health.status === 'degraded') {
  console.warn('Cache issues:', health.issues);
}
```

#### Memory Usage Tracking

```javascript
const memory = cache.getMemoryUsage();
console.log({
  spriteCount: memory.spriteCount,
  totalSizeMB: memory.totalSizeMB,
  avgSpriteSize: memory.avgSpriteSize,
  biggestSprite: memory.biggestSprite
});
```

#### Export Monitoring Data

```javascript
const monitoring = cache.exportMonitoringData();
// Send to monitoring system
console.log(JSON.stringify(monitoring, null, 2));
```

#### Cache Validation

```javascript
const validation = cache.validateCache();
if (!validation.valid) {
  console.error('Cache errors:', validation.errors);
}
validation.warnings.forEach(warning => {
  console.warn('Warning:', warning);
});
```

## Implementation Guide

### Basic Usage

```javascript
import { initializeSpriteCache, getSprite, getCacheStats } from './roulette/sprites.js';

// Initialize the cache system
await initializeSpriteCache();

// Preload essential sprites
await preloadEssentialSprites();

// Get sprites as needed
const wheelBase = await getSprite('wheelBase');
const numbers = await getSprite('numbersOverlay');
const ball = await getSprite('ball');

// Use in canvas rendering
const ctx = canvas.getContext('2d');
ctx.drawImage(wheelBase, 0, 0);
ctx.drawImage(numbers, 0, 0);
ctx.drawImage(ball, x, y);
```

### Integration with Roulette Wheel

```javascript
import { getSpriteCache } from './roulette/sprites.js';

class RouletteWheel {
  constructor() {
    this.cache = getSpriteCache();
    this.initialize();
  }

  async initialize() {
    await this.cache.initialize();
    await this.cache.preloadEssential();
  }

  async render(ctx, angle) {
    // Get cached sprites
    const wheelBase = await this.cache.getSprite('wheelBase');
    const numbers = await this.cache.getSprite('numbersOverlay');
    
    // Render with rotation
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(angle);
    ctx.drawImage(wheelBase, -300, -300);
    ctx.drawImage(numbers, -300, -300);
    ctx.restore();
  }
}
```

### Memory Management Example

```javascript
import { getSpriteCache } from './roulette/sprites.js';

const cache = getSpriteCache();

// Periodic memory cleanup
setInterval(() => {
  const memory = cache.getMemoryUsage();
  
  if (memory.totalSizeMB > 50) {
    console.log('High memory usage, clearing volatile sprites...');
    cache.clearVolatile();
  }
}, 60000); // Every minute

// Cache health monitoring
setInterval(() => {
  const health = cache.getHealthStatus();
  if (health.status !== 'healthy') {
    console.warn('Cache health:', health);
  }
}, 300000); // Every 5 minutes
```

## Technical Details

### Pocket Layout

The system uses European roulette layout (single zero):

```javascript
const europeanLayout = [
  { color: 'green', number: '0' },
  { color: 'red', number: '32' },
  { color: 'black', number: '15' },
  // ... continues for all 37 pockets
];
```

### Color Scheme

- **Red**: #CC0000
- **Black**: #000000
- **Green**: #006600
- **Rim**: Metallic gradient (silver tones)
- **Hub**: Metallic gradient (silver tones)

### Rendering Features

#### Wheel Base
- Metallic rim with gradient shading
- Wood texture background
- 37 pockets with proper colors
- Center hub with metallic finish
- Bevel effects for depth

#### Numbers Overlay
- High-contrast text
- Shadow effects for readability
- Proper positioning on pocket centers
- Color-matched text (white on black, black on others)

#### Ball Sprite
- Radial gradient for 3D appearance
- Specular highlight for realism
- Subtle border
- Optimized size (40x40px)

### Cache Architecture

```
SpriteCache
├── cache: Map<string, Canvas>
├── configs: Map<string, SpriteConfig>
├── stats: CacheStats
└── cacheDir: string
```

### Memory Tracking

The system tracks memory usage by:
- Individual sprite sizes
- Total cache size
- Average sprite size
- Biggest sprite identification

## Error Handling

The system includes comprehensive error handling:

```javascript
try {
  const sprite = await getSprite('wheelBase');
} catch (error) {
  if (error.message.includes('Unknown sprite key')) {
    // Handle unknown sprite
  } else if (error.message.includes('generation failed')) {
    // Handle generation error
  }
}
```

## Performance Considerations

### Best Practices

1. **Preload Essential Sprites**: Call `preloadEssentialSprites()` during initialization
2. **Monitor Cache Health**: Regularly check `getHealthStatus()`
3. **Clear Volatile Sprites**: Use `clearVolatile()` during memory pressure
4. **Use Lazy Loading**: Let the cache generate sprites on-demand

### Performance Tips

- Sprite size: 600x600 for wheel components, 40x40 for ball
- Cache hit rate target: >80%
- Memory usage target: <100MB
- Generate time: <100ms per sprite

## Troubleshooting

### Common Issues

**Low Cache Hit Rate**
```javascript
// Check if sprites are being cached properly
const stats = getCacheStats();
console.log('Hit rate:', stats.hitRate);

// Ensure sprites are preloaded
await preloadEssentialSprites();
```

**High Memory Usage**
```javascript
// Monitor memory usage
const memory = cache.getMemoryUsage();
console.log('Total MB:', memory.totalSizeMB);

// Clear volatile sprites
cache.clearVolatile();
```

**Sprite Generation Fails**
```javascript
// Check canvas dependencies
const { createCanvas } = require('canvas');

// Verify node-canvas is installed
npm list canvas
```

## Development

### Testing

Run the test suite:

```bash
npm test -- sprites.test.js
```

### Debug Mode

Enable debug logging:

```bash
DEBUG_SPRITES=1 npm run dev
```

## Changelog

### Version 1.0.0
- Initial release
- Lazy sprite generation and caching
- Memory management system
- Health monitoring
- Comprehensive JSDoc documentation
- Test suite included

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review the test suite for examples
- Enable DEBUG_SPRITES for detailed logging
