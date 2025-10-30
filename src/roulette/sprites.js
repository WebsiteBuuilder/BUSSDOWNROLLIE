/**
 * @file sprites.js
 * @description Comprehensive sprite caching system for roulette wheel assets with memory management and automated generation
 * @author GUHD EATS Development Team
 * @version 1.0.0
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs/promises';
import path from 'path';

/**
 * Cache statistics and monitoring interface
 * @typedef {Object} CacheStats
 * @property {number} hits - Number of cache hits
 * @property {number} misses - Number of cache misses
 * @property {number} totalRequests - Total number of cache requests
 * @property {number} cacheSize - Current cache size in bytes
 * @property {Map<string, number>} spriteSizes - Individual sprite sizes
 * @property {number} lastAccessed - Timestamp of last cache access
 */

/**
 * Sprite configuration interface
 * @typedef {Object} SpriteConfig
 * @property {number} width - Sprite width in pixels
 * @property {number} height - Sprite height in pixels
 * @property {string[]} cacheKeys - Cache keys this sprite depends on
 * @property {boolean} volatile - Whether this sprite should be cleared on memory pressure
 */

/**
 * Roulette pocket configuration
 * @typedef {Object} PocketConfig
 * @property {string} color - Pocket color (red, black, green)
 * @property {string} number - Pocket number (0-36 or 00)
 * @property {number} startAngle - Starting angle in radians
 * @property {number} endAngle - Ending angle in radians
 */

/**
 * @class SpriteCache
 * @description Comprehensive sprite caching system with lazy loading, memory management, and automated generation
 */
class SpriteCache {
  /**
   * Initialize the sprite cache system
   * @constructor
   */
  constructor() {
    /** @type {Map<string, any>} */
    this.cache = new Map();
    
    /** @type {Map<string, SpriteConfig>} */
    this.configs = new Map();
    
    /** @type {CacheStats} */
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      cacheSize: 0,
      spriteSizes: new Map(),
      lastAccessed: Date.now()
    };
    
    /** @type {string} */
    this.cacheDir = './cache/sprites';
    
    /** @type {boolean} */
    this.initialized = false;
    
    this._initializeConfigs();
  }

  /**
   * Initialize sprite configurations
   * @private
   */
  _initializeConfigs() {
    this.configs.set('wheelBase', {
      width: 600,
      height: 600,
      cacheKeys: [],
      volatile: false
    });
    
    this.configs.set('numbersOverlay', {
      width: 600,
      height: 600,
      cacheKeys: ['wheelBase'],
      volatile: false
    });
    
    this.configs.set('pocketMask', {
      width: 600,
      height: 600,
      cacheKeys: ['wheelBase'],
      volatile: false
    });
    
    this.configs.set('ball', {
      width: 40,
      height: 40,
      cacheKeys: [],
      volatile: true
    });
    
    this.configs.set('pocketColors', {
      width: 600,
      height: 600,
      cacheKeys: ['wheelBase'],
      volatile: false
    });
  }

  /**
   * Initialize the cache system and ensure cache directory exists
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
      this._log('Sprite cache system initialized', 'info');
    } catch (error) {
      this._log(`Failed to initialize cache: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get a sprite from cache or generate it if not cached
   * @param {string} spriteKey - The sprite key to retrieve
   * @returns {Promise<any>} The cached or generated sprite
   * @throws {Error} If sprite generation fails
   */
  async getSprite(spriteKey) {
    this.stats.lastAccessed = Date.now();
    this.stats.totalRequests++;
    
    // Check cache first
    if (this.cache.has(spriteKey)) {
      this.stats.hits++;
      this._log(`Cache hit for ${spriteKey}`, 'debug');
      return this.cache.get(spriteKey);
    }
    
    this.stats.misses++;
    this._log(`Cache miss for ${spriteKey}, generating...`, 'debug');
    
    // Generate sprite if not cached
    const sprite = await this._generateSprite(spriteKey);
    
    // Cache the generated sprite
    await this._cacheSprite(spriteKey, sprite);
    
    return sprite;
  }

  /**
   * Generate a sprite based on its type
   * @private
   * @param {string} spriteKey - The sprite key to generate
   * @returns {Promise<any>} The generated sprite
   * @throws {Error} If sprite generation fails
   */
  async _generateSprite(spriteKey) {
    const config = this.configs.get(spriteKey);
    if (!config) {
      throw new Error(`Unknown sprite key: ${spriteKey}`);
    }
    
    try {
      switch (spriteKey) {
        case 'wheelBase':
          return await this._generateWheelBase(config.width, config.height);
        case 'numbersOverlay':
          return await this._generateNumbersOverlay(config.width, config.height);
        case 'pocketMask':
          return await this._generatePocketMask(config.width, config.height);
        case 'ball':
          return await this._generateBallSprite(config.width, config.height);
        case 'pocketColors':
          return await this._generatePocketColors(config.width, config.height);
        default:
          throw new Error(`No generator available for sprite: ${spriteKey}`);
      }
    } catch (error) {
      this._log(`Failed to generate sprite ${spriteKey}: ${error.message}`, 'error');
      throw new Error(`Sprite generation failed for ${spriteKey}: ${error.message}`);
    }
  }

  /**
   * Generate the wheel base with enhanced metallic bevel effects and realistic gradients
   * @private
   * @param {number} width - Wheel width
   * @param {number} height - Wheel height
   * @returns {Promise<any>} Generated wheel base canvas
   */
  async _generateWheelBase(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Calculate wheel dimensions
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const rimWidth = 35;
    const pocketRadius = outerRadius - rimWidth - 10;
    const hubRadius = 45;
    const bevelWidth = 8;
    
    // === ENHANCED OUTER METALLIC RIM WITH PREMIUM GRADIENTS ===
    // Multi-layer gradient for realistic chrome effect
    const chromeGradient = ctx.createRadialGradient(
      centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, 0,
      centerX, centerY, outerRadius
    );
    chromeGradient.addColorStop(0, '#F5F5F5');     // Bright highlight
    chromeGradient.addColorStop(0.15, '#E8E8E8');   // Light chrome
    chromeGradient.addColorStop(0.3, '#D0D0D0');    // Medium chrome
    chromeGradient.addColorStop(0.45, '#C0C0C0');   // Base chrome
    chromeGradient.addColorStop(0.6, '#B8B8B8');    // Darker chrome
    chromeGradient.addColorStop(0.75, '#A8A8A8');   // Deep chrome
    chromeGradient.addColorStop(0.9, '#909090');    // Shadow
    chromeGradient.addColorStop(1, '#707070');      // Deep shadow
    
    ctx.fillStyle = chromeGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // === ENHANCED BEVEL EFFECTS ===
    // Inner bevel (highlight)
    const innerBevel = ctx.createRadialGradient(
      centerX - outerRadius * 0.15, centerY - outerRadius * 0.15, pocketRadius + 5,
      centerX, centerY, outerRadius
    );
    innerBevel.addColorStop(0, 'rgba(255,255,255,0.9)');
    innerBevel.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    innerBevel.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    innerBevel.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = innerBevel;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, pocketRadius + bevelWidth, 0, Math.PI * 2, true);
    ctx.fill();
    
    // Outer bevel (shadow)
    const outerBevel = ctx.createRadialGradient(
      centerX + outerRadius * 0.1, centerY + outerRadius * 0.1, outerRadius * 0.7,
      centerX, centerY, outerRadius
    );
    outerBevel.addColorStop(0, 'rgba(0,0,0,0)');
    outerBevel.addColorStop(0.3, 'rgba(0,0,0,0.1)');
    outerBevel.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    outerBevel.addColorStop(1, 'rgba(0,0,0,0.5)');
    
    ctx.fillStyle = outerBevel;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, outerRadius - bevelWidth, 0, Math.PI * 2, true);
    ctx.fill();
    
    // === BRUSHED METAL EFFECT FOR RIM ===
    // Add subtle horizontal lines for brushed texture
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const startRadius = outerRadius - 5;
      const endRadius = outerRadius - rimWidth + 5;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, startRadius - i * 0.3, angle - 0.1, angle + 0.1);
      ctx.stroke();
    }
    ctx.restore();
    
    // === PREMIUM WOOD GRAIN BACKGROUND ===
    // Multi-layered wood texture
    const woodGradient = ctx.createRadialGradient(
      centerX, centerY, pocketRadius * 0.2,
      centerX, centerY, pocketRadius
    );
    woodGradient.addColorStop(0, '#3D2914');  // Light center
    woodGradient.addColorStop(0.3, '#2F1F0F');
    woodGradient.addColorStop(0.6, '#2A1B0C');
    woodGradient.addColorStop(0.8, '#241708');
    woodGradient.addColorStop(1, '#1F1406');   // Dark edge
    
    ctx.fillStyle = woodGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pocketRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add subtle wood grain lines
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#4A3420';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 15; i++) {
      const grainAngle = (i / 15) * Math.PI * 2;
      const grainRadius = pocketRadius * (0.3 + (i % 3) * 0.2);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, grainRadius, grainAngle - 0.3, grainAngle + 0.3);
      ctx.stroke();
    }
    ctx.restore();
    
    // === PREMIUM POCKET DESIGN WITH ENHANCED COLORS ===
    const pockets = this._getPocketLayout();
    for (const pocket of pockets) {
      const segmentAngle = pocket.endAngle - pocket.startAngle;
      const segmentWidth = pocketRadius;
      
      // Enhanced color gradients for each pocket type
      let baseColor, highlightColor, shadowColor;
      switch (pocket.color) {
        case 'red':
          baseColor = '#CC0000';
          highlightColor = '#FF3333';
          shadowColor = '#990000';
          break;
        case 'black':
          baseColor = '#000000';
          highlightColor = '#333333';
          shadowColor = '#000000';
          break;
        case 'green':
          baseColor = '#006600';
          highlightColor = '#00AA00';
          shadowColor = '#004400';
          break;
        default:
          baseColor = '#666666';
          highlightColor = '#888888';
          shadowColor = '#444444';
      }
      
      // Create multi-stop gradient for realistic pocket depth
      const pocketGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, pocketRadius
      );
      
      pocketGradient.addColorStop(0, highlightColor);
      pocketGradient.addColorStop(0.4, baseColor);
      pocketGradient.addColorStop(0.8, shadowColor);
      pocketGradient.addColorStop(1, this._darkenColor(shadowColor, 30));
      
      // Draw pocket shape
      ctx.fillStyle = pocketGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, segmentWidth, pocket.startAngle, pocket.endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fill();
      
      // Add subtle inset shadow for depth
      const insetShadow = ctx.createLinearGradient(
        centerX, centerY,
        centerX + Math.cos((pocket.startAngle + pocket.endAngle) / 2) * pocketRadius,
        centerY + Math.sin((pocket.startAngle + pocket.endAngle) / 2) * pocketRadius
      );
      insetShadow.addColorStop(0, 'rgba(0,0,0,0)');
      insetShadow.addColorStop(1, 'rgba(0,0,0,0.2)');
      
      ctx.fillStyle = insetShadow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, segmentWidth - 2, pocket.startAngle, pocket.endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fill();
      
      // Enhanced pocket borders with metallic effect
      ctx.strokeStyle = pocket.color === 'green' ? '#004400' : '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pocketRadius, pocket.startAngle, pocket.endAngle);
      ctx.arc(centerX, centerY, pocketRadius - 6, pocket.endAngle, pocket.startAngle, true);
      ctx.closePath();
      ctx.stroke();
      
      // Add subtle border highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pocketRadius - 1, pocket.startAngle, pocket.endAngle);
      ctx.stroke();
    }
    
    // === ADDITIONAL PREMIUM DETAILS ===
    // Ball track separator line
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, pocketRadius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Decorative dots around rim
    ctx.fillStyle = '#FFD700';
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 37; i++) {
      const dotAngle = (i / 37) * Math.PI * 2;
      const dotRadius = outerRadius - 8;
      const dotX = centerX + Math.cos(dotAngle) * dotRadius;
      const dotY = centerY + Math.sin(dotAngle) * dotRadius;
      
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // === ENHANCED CENTER HUB WITH PREMIUM FINISH ===
    // Multi-layer hub with chrome effect
    const hubChromeGradient = ctx.createRadialGradient(
      centerX - hubRadius * 0.2, centerY - hubRadius * 0.2, 0,
      centerX, centerY, hubRadius
    );
    hubChromeGradient.addColorStop(0, '#FFFFFF');     // Bright center
    hubChromeGradient.addColorStop(0.2, '#F0F0F0');   // Very light
    hubChromeGradient.addColorStop(0.4, '#E0E0E0');   // Light
    hubChromeGradient.addColorStop(0.6, '#D0D0D0');   // Medium
    hubChromeGradient.addColorStop(0.8, '#C0C0C0');   // Darker
    hubChromeGradient.addColorStop(1, '#B0B0B0');     // Dark edge
    
    ctx.fillStyle = hubChromeGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner hub highlight ring
    const hubRing = ctx.createRadialGradient(
      centerX - hubRadius * 0.1, centerY - hubRadius * 0.1, 0,
      centerX, centerY, hubRadius * 0.8
    );
    hubRing.addColorStop(0, 'rgba(255,255,255,0.8)');
    hubRing.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    hubRing.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = hubRing;
    ctx.beginPath();
    ctx.arc(centerX, centerY, hubRadius * 0.85, 0, Math.PI * 2);
    ctx.fill();
    
    // Hub border with bevel
    const borderGradient = ctx.createLinearGradient(
      centerX - hubRadius, centerY - hubRadius,
      centerX + hubRadius, centerY + hubRadius
    );
    borderGradient.addColorStop(0, '#909090');
    borderGradient.addColorStop(0.5, '#606060');
    borderGradient.addColorStop(1, '#808080');
    
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Add hub screw details
    ctx.save();
    ctx.fillStyle = '#505050';
    ctx.globalAlpha = 0.6;
    
    for (let i = 0; i < 6; i++) {
      const screwAngle = (i / 6) * Math.PI * 2;
      const screwRadius = hubRadius * 0.6;
      const screwX = centerX + Math.cos(screwAngle) * screwRadius;
      const screwY = centerY + Math.sin(screwAngle) * screwRadius;
      
      ctx.beginPath();
      ctx.arc(screwX, screwY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    
    return canvas;
  }

  /**
   * Generate the numbers overlay with proper fonts and colors
   * @private
   * @param {number} width - Overlay width
   * @param {number} height - Overlay height
   * @returns {Promise<any>} Generated numbers overlay canvas
   */
  async _generateNumbersOverlay(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const pocketRadius = Math.min(width, height) / 2 - 50;
    const textRadius = pocketRadius - 15;
    
    // Set up text rendering
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const pockets = this._getPocketLayout();
    
    for (const pocket of pockets) {
      // Calculate position for number text
      const angle = (pocket.startAngle + pocket.endAngle) / 2;
      const textX = centerX + Math.cos(angle) * textRadius;
      const textY = centerY + Math.sin(angle) * textRadius;
      
      // Set text color based on pocket color
      let textColor;
      if (pocket.color === 'black') {
        textColor = '#FFFFFF';
      } else {
        textColor = '#000000';
      }
      
      // Draw text shadow for better visibility
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillText(pocket.number, textX + 1, textY + 1);
      
      // Draw main text
      ctx.fillStyle = textColor;
      ctx.fillText(pocket.number, textX, textY);
    }
    
    return canvas;
  }

  /**
   * Generate pocket mask for ball landing detection
   * @private
   * @param {number} width - Mask width
   * @param {number} height - Mask height
   * @returns {Promise<any>} Generated pocket mask canvas
   */
  async _generatePocketMask(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Set up mask (black and white only)
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#FFFFFF';
    
    const centerX = width / 2;
    const centerY = height / 2;
    const pocketRadius = Math.min(width, height) / 2 - 50;
    
    const pockets = this._getPocketLayout();
    
    for (let i = 0; i < pockets.length; i++) {
      const pocket = pockets[i];
      const nextPocket = pockets[(i + 1) % pockets.length];
      
      // Create pocket shape
      ctx.beginPath();
      ctx.arc(centerX, centerY, pocketRadius, pocket.startAngle, nextPocket.startAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fill();
    }
    
    return canvas;
  }

  /**
   * Generate premium ball sprite with enhanced shading and specular highlights
   * @private
   * @param {number} width - Ball width
   * @param {number} height - Ball height
   * @returns {Promise<any>} Generated ball sprite canvas
   */
  async _generateBallSprite(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 2;
    
    // === PREMIUM BALL BASE WITH MULTI-LAYER GRADIENTS ===
    // Base ball gradient with realistic lighting
    const baseGradient = ctx.createRadialGradient(
      centerX - radius * 0.25,
      centerY - radius * 0.25,
      radius * 0.1,
      centerX,
      centerY,
      radius
    );
    
    baseGradient.addColorStop(0, '#FFFFFF');      // Bright highlight
    baseGradient.addColorStop(0.3, '#F8F8F8');    // Very light
    baseGradient.addColorStop(0.6, '#F0F0F0');    // Light
    baseGradient.addColorStop(0.85, '#E5E5E5');   // Medium
    baseGradient.addColorStop(1, '#D8D8D8');      // Shadow edge
    
    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // === ENHANCED BORDER WITH BEVEL EFFECT ===
    // Inner border highlight
    const borderGradient = ctx.createRadialGradient(
      centerX, centerY, radius * 0.7,
      centerX, centerY, radius
    );
    borderGradient.addColorStop(0, 'rgba(255,255,255,0)');
    borderGradient.addColorStop(0.8, 'rgba(255,255,255,0.4)');
    borderGradient.addColorStop(1, 'rgba(255,255,255,0.8)');
    
    ctx.fillStyle = borderGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, radius * 0.95, 0, Math.PI * 2, true);
    ctx.fill();
    
    // Outer rim shadow
    const rimShadow = ctx.createRadialGradient(
      centerX + radius * 0.1,
      centerY + radius * 0.1,
      radius * 0.8,
      centerX,
      centerY,
      radius
    );
    rimShadow.addColorStop(0, 'rgba(0,0,0,0)');
    rimShadow.addColorStop(0.9, 'rgba(0,0,0,0.2)');
    rimShadow.addColorStop(1, 'rgba(0,0,0,0.4)');
    
    ctx.fillStyle = rimShadow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, radius * 0.98, 0, Math.PI * 2, true);
    ctx.fill();
    
    // === PREMIUM SPECULAR HIGHLIGHT SYSTEM ===
    // Primary highlight (brightest)
    const primaryHighlight = ctx.createRadialGradient(
      centerX - radius * 0.35,
      centerY - radius * 0.35,
      0,
      centerX - radius * 0.35,
      centerY - radius * 0.35,
      radius * 0.4
    );
    primaryHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    primaryHighlight.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    primaryHighlight.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    primaryHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = primaryHighlight;
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.35, centerY - radius * 0.35, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Secondary highlight (softer)
    const secondaryHighlight = ctx.createRadialGradient(
      centerX - radius * 0.2,
      centerY - radius * 0.2,
      0,
      centerX - radius * 0.2,
      centerY - radius * 0.2,
      radius * 0.6
    );
    secondaryHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    secondaryHighlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    secondaryHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = secondaryHighlight;
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.2, centerY - radius * 0.2, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // === SURFACE DETAILS FOR REALISM ===
    // Add subtle surface texture
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 0.5;
    
    // Draw subtle curved lines for surface reflection
    for (let i = 0; i < 3; i++) {
      const curveRadius = radius * (0.3 + i * 0.2);
      const curveOffsetX = centerX - radius * 0.1;
      const curveOffsetY = centerY - radius * 0.1;
      
      ctx.beginPath();
      ctx.arc(curveOffsetX, curveOffsetY, curveRadius, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
    ctx.restore();
    
    // === ENVIRONMENTAL REFLECTION ===
    // Add environmental light reflection
    const envReflection = ctx.createRadialGradient(
      centerX + radius * 0.15,
      centerY - radius * 0.25,
      0,
      centerX + radius * 0.15,
      centerY - radius * 0.25,
      radius * 0.5
    );
    envReflection.addColorStop(0, 'rgba(200, 220, 255, 0.3)');
    envReflection.addColorStop(0.5, 'rgba(180, 200, 255, 0.15)');
    envReflection.addColorStop(1, 'rgba(160, 180, 255, 0)');
    
    ctx.fillStyle = envReflection;
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.15, centerY - radius * 0.25, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    return canvas;
  }

  /**
   * Generate pocket colors visualization
   * @private
   * @param {number} width - Width
   * @param {number} height - Height
   * @returns {Promise<any>} Generated pocket colors canvas
   */
  async _generatePocketColors(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    const centerX = width / 2;
    const centerY = height / 2;
    const pocketRadius = Math.min(width, height) / 2 - 50;
    
    const pockets = this._getPocketLayout();
    
    for (const pocket of pockets) {
      let color;
      switch (pocket.color) {
        case 'red':
          color = '#CC0000';
          break;
        case 'black':
          color = '#000000';
          break;
        case 'green':
          color = '#006600';
          break;
        default:
          color = '#666666';
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pocketRadius, pocket.startAngle, pocket.endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fill();
    }
    
    return canvas;
  }

  /**
   * Cache a sprite in memory and optionally to disk
   * @private
   * @param {string} key - Cache key
   * @param {any} sprite - Sprite to cache
   * @returns {Promise<void>}
   */
  async _cacheSprite(key, sprite) {
    try {
      // Store in memory cache
      this.cache.set(key, sprite);
      
      // Calculate and store size
      const config = this.configs.get(key);
      if (config) {
        const estimatedSize = config.width * config.height * 4; // RGBA
        this.stats.cacheSize += estimatedSize;
        this.stats.spriteSizes.set(key, estimatedSize);
      }
      
      this._log(`Cached sprite: ${key}`, 'debug');
    } catch (error) {
      this._log(`Failed to cache sprite ${key}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Get roulette pocket layout with proper numbering and colors
   * @private
   * @returns {PocketConfig[]} Array of pocket configurations
   */
  _getPocketLayout() {
    const pockets = [];
    
    // European roulette layout (single zero)
    const europeanLayout = [
      { color: 'green', number: '0' },
      { color: 'red', number: '32' },
      { color: 'black', number: '15' },
      { color: 'red', number: '19' },
      { color: 'black', number: '4' },
      { color: 'red', number: '21' },
      { color: 'black', number: '2' },
      { color: 'red', number: '25' },
      { color: 'black', number: '17' },
      { color: 'red', number: '34' },
      { color: 'black', number: '6' },
      { color: 'red', number: '27' },
      { color: 'black', number: '13' },
      { color: 'red', number: '36' },
      { color: 'black', number: '11' },
      { color: 'red', number: '30' },
      { color: 'black', number: '8' },
      { color: 'red', number: '23' },
      { color: 'black', number: '10' },
      { color: 'red', number: '5' },
      { color: 'black', number: '24' },
      { color: 'red', number: '16' },
      { color: 'black', number: '33' },
      { color: 'red', number: '1' },
      { color: 'black', number: '20' },
      { color: 'red', number: '14' },
      { color: 'black', number: '31' },
      { color: 'red', number: '9' },
      { color: 'black', number: '22' },
      { color: 'red', number: '18' },
      { color: 'black', number: '29' },
      { color: 'red', number: '7' },
      { color: 'black', number: '28' },
      { color: 'red', number: '12' },
      { color: 'black', number: '35' },
      { color: 'red', number: '3' },
      { color: 'black', number: '26' }
    ];
    
    // Calculate angle for each pocket
    const angleStep = (Math.PI * 2) / europeanLayout.length;
    
    for (let i = 0; i < europeanLayout.length; i++) {
      pockets.push({
        color: europeanLayout[i].color,
        number: europeanLayout[i].number,
        startAngle: i * angleStep,
        endAngle: (i + 1) * angleStep
      });
    }
    
    return pockets;
  }

  /**
   * Lighten a hex color by a percentage
   * @private
   * @param {string} hex - Hex color string
   * @param {number} percent - Percentage to lighten (0-100)
   * @returns {string} Lightened hex color
   */
  _lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * Darken a hex color by a percentage
   * @private
   * @param {string} hex - Hex color string
   * @param {number} percent - Percentage to darken (0-100)
   * @returns {string} Darkened hex color
   */
  _darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, (num >> 8 & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * Clear the entire cache
   * @returns {void}
   */
  clearCache() {
    const count = this.cache.size;
    this.cache.clear();
    this.stats.cacheSize = 0;
    this.stats.spriteSizes.clear();
    this._log(`Cleared cache (${count} sprites)`, 'info');
  }

  /**
   * Clear volatile sprites from cache (ball sprites, temporary assets)
   * @returns {number} Number of sprites cleared
   */
  clearVolatile() {
    let cleared = 0;
    
    for (const [key, config] of this.configs.entries()) {
      if (config.volatile && this.cache.has(key)) {
        this.cache.delete(key);
        const size = this.stats.spriteSizes.get(key) || 0;
        this.stats.cacheSize -= size;
        this.stats.spriteSizes.delete(key);
        cleared++;
      }
    }
    
    this._log(`Cleared ${cleared} volatile sprites`, 'debug');
    return cleared;
  }

  /**
   * Clear specific sprite from cache
   * @param {string} key - Sprite key to clear
   * @returns {boolean} True if sprite was cleared
   */
  clearSprite(key) {
    if (this.cache.has(key)) {
      const size = this.stats.spriteSizes.get(key) || 0;
      this.cache.delete(key);
      this.stats.cacheSize -= size;
      this.stats.spriteSizes.delete(key);
      this._log(`Cleared sprite: ${key}`, 'debug');
      return true;
    }
    return false;
  }

  /**
   * Preload essential sprites for performance
   * @returns {Promise<void>}
   */
  async preloadEssential() {
    const essential = ['wheelBase', 'numbersOverlay', 'pocketMask'];
    
    for (const spriteKey of essential) {
      if (!this.cache.has(spriteKey)) {
        await this.getSprite(spriteKey);
      }
    }
    
    this._log('Preloaded essential sprites', 'info');
  }

  /**
   * Get cache statistics
   * @returns {CacheStats} Current cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      spriteSizes: new Map(this.stats.spriteSizes),
      hitRate: this.stats.totalRequests > 0 
        ? (this.stats.hits / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Get memory usage information
   * @returns {Object} Memory usage details
   */
  getMemoryUsage() {
    const cacheCount = this.cache.size;
    const totalSize = this.stats.cacheSize;
    
    return {
      spriteCount: cacheCount,
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      avgSpriteSize: cacheCount > 0 ? (totalSize / cacheCount).toFixed(0) : 0,
      biggestSprite: this._getBiggestSprite()
    };
  }

  /**
   * Get the largest cached sprite
   * @private
   * @returns {Object} Biggest sprite information
   */
  _getBiggestSprite() {
    let maxSize = 0;
    let maxKey = null;
    
    for (const [key, size] of this.stats.spriteSizes.entries()) {
      if (size > maxSize) {
        maxSize = size;
        maxKey = key;
      }
    }
    
    return maxKey ? { key: maxKey, size: maxSize } : null;
  }

  /**
   * Validate cache integrity
   * @returns {Object} Validation results
   */
  validateCache() {
    const results = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Check for orphaned sprites
    for (const key of this.cache.keys()) {
      const config = this.configs.get(key);
      if (!config) {
        results.valid = false;
        results.errors.push(`Sprite '${key}' has no configuration`);
      }
    }
    
    // Check cache size against estimates
    const estimatedSize = Array.from(this.configs.entries())
      .reduce((sum, [key, config]) => {
        if (this.cache.has(key)) {
          return sum + (config.width * config.height * 4);
        }
        return sum;
      }, 0);
    
    if (Math.abs(this.stats.cacheSize - estimatedSize) > 1000) {
      results.warnings.push('Cache size mismatch detected');
    }
    
    return results;
  }

  /**
   * Get cached sprite keys
   * @returns {string[]} Array of cached sprite keys
   */
  getCachedKeys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if a sprite is cached
   * @param {string} key - Sprite key
   * @returns {boolean} True if sprite is cached
   */
  hasSprite(key) {
    return this.cache.has(key);
  }

  /**
   * Get cache health status
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    const stats = this.getStats();
    const memory = this.getMemoryUsage();
    
    let status = 'healthy';
    const issues = [];
    
    // Check hit rate
    const hitRate = parseFloat(stats.hitRate);
    if (hitRate < 50) {
      status = 'degraded';
      issues.push('Low cache hit rate');
    }
    
    // Check cache size
    if (memory.totalSizeMB > 100) {
      status = 'degraded';
      issues.push('High memory usage');
    }
    
    // Check for stale cache
    const timeSinceAccess = Date.now() - stats.lastAccessed;
    if (timeSinceAccess > 300000) { // 5 minutes
      issues.push('Cache not accessed recently');
    }
    
    return {
      status,
      issues,
      stats,
      memory
    };
  }

  /**
   * Log messages with appropriate level
   * @private
   * @param {string} message - Log message
   * @param {string} level - Log level (debug, info, warn, error)
   */
  _log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [SpriteCache:${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'debug':
        if (process.env.DEBUG_SPRITES) console.log(logMessage);
        break;
      case 'info':
        console.log(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  /**
   * Export cache statistics for monitoring
   * @returns {Object} Monitoring data
   */
  exportMonitoringData() {
    return {
      timestamp: Date.now(),
      stats: this.getStats(),
      memory: this.getMemoryUsage(),
      health: this.getHealthStatus(),
      validation: this.validateCache()
    };
  }

  /**
   * Shutdown cleanup
   * @returns {void}
   */
  shutdown() {
    this._log('Shutting down sprite cache system', 'info');
    this.clearCache();
  }
}

// Create singleton instance
const spriteCache = new SpriteCache();

/**
 * Get the sprite cache instance
 * @returns {SpriteCache} The singleton sprite cache instance
 */
export function getSpriteCache() {
  return spriteCache;
}

/**
 * Initialize the sprite cache system
 * @returns {Promise<void>}
 */
export async function initializeSpriteCache() {
  return await spriteCache.initialize();
}

/**
 * Get a cached sprite or generate it
 * @param {string} key - Sprite key
 * @returns {Promise<any>} The sprite
 */
export async function getSprite(key) {
  return await spriteCache.getSprite(key);
}

/**
 * Get cache statistics
 * @returns {CacheStats} Cache statistics
 */
export function getCacheStats() {
  return spriteCache.getStats();
}

/**
 * Clear the entire cache
 */
export function clearCache() {
  spriteCache.clearCache();
}

/**
 * Clear volatile sprites from cache
 * @returns {number} Number of sprites cleared
 */
export function clearVolatile() {
  return spriteCache.clearVolatile();
}

/**
 * Preload essential sprites for better performance
 * @returns {Promise<void>}
 */
export async function preloadEssentialSprites() {
  return await spriteCache.preloadEssential();
}

/**
 * Export sprite cache module
 */
export default spriteCache;
