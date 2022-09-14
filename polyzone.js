const LOCAL_EVENT_PREFIX = '__PolyZoneJS__:';
const defaultColorWalls = [0, 255, 0];
const defaultColorOutline = [255, 0, 0];
const defaultColorGrid = [255, 255, 255];
const HEAD_BONE = 0x796e;

const PolyVectorTools = {
  vector2: (x, y) => ({
    x: x * 1.0,
    y: y * 1.0
  }),
  vector3: (x, y, z) => ({
    x: x * 1.0,
    y: y * 1.0,
    z: z * 1.0
  }),
  vector4: (x, y, z, w) => ({
    x: x * 1.0,
    y: y * 1.0,
    z: z * 1.0,
    heading: w * 1.0
  }),
  diff2D: (p1, p2) => {
    return PolyVectorTools.vector2(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
  },
  distance2D: (p1, p2) => {
    const x = p1.x - p2.x;
    const y = p1.y - p2.y;
    return Math.sqrt(x * x + y * y);
  },
  midpoint2D: (p1, p2) => PolyVectorTools.vector2((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
};

// Utility functions
const _isLeft = (p0, p1, p2) => {
  const p0x = p0.x;
  const p0y = p0.y;
  return (p1.x - p0x) * (p2.y - p0y) - (p2.x - p0x) * (p1.y - p0y);
};

const _wn_inner_loop = (p0, p1, p2, wn) => {
  const p2y = p2.y;
  if (p0.y <= p2y) {
    if (p1.y > p2y) {
      if (_isLeft(p0, p1, p2) > 0) {
        return wn + 1;
      }
    }
  } else {
    if (p1.y <= p2y) {
      if (_isLeft(p0, p1, p2) < 0) {
        return wn - 1;
      }
    }
  }
  return wn;
};

const addBlip = (pos) => {
  const blip = AddBlipForCoord(pos.x, pos.y, 0.0);
  SetBlipColour(blip, 7);
  SetBlipDisplay(blip, 8);
  SetBlipScale(blip, 1.0);
  SetBlipAsShortRange(blip, true);
  return blip;
};

const clearTbl = (tbl) => {
  // Only works with contiguous (array-like) tables
  return tbl && tbl.length ? new Array(tbl.length).fill(null) : [];
};

const copyTbl = (tbl) => {
  // Only a shallow copy, and only works with contiguous (array-like) tables
  return tbl && tbl.length && typeof tbl === 'array' ? [...tbl] : [];
};

// Winding Number Algorithm - http://geomalgorithms.com/a03-_inclusion.html
const windingNumber = (point, poly) => {
  let wn = 0; // winding number counter
  // loop through all edges of the polygon
  for (let i = 0; i < poly.length - 1; i++) {
    wn = _wn_inner_loop(poly[i], poly[i + 1], point, wn);
  }
  // test last point to first point, completing the polygon
  wn = _wn_inner_loop(poly[poly.length - 1], poly[0], point, wn);
  // the point is outside only when this winding number wn===0, otherwise it's inside
  return wn !== 0;
};

// Detects intersection between two lines
const isIntersecting = (a, b, c, d) => {
  // Store calculations in local variables for performance
  const ax_minus_cx = a.x - c.x;
  const bx_minus_ax = b.x - a.x;
  const dx_minus_cx = d.x - c.x;
  const ay_minus_cy = a.y - c.y;
  const by_minus_ay = b.y - a.y;
  const dy_minus_cy = d.y - c.y;
  const denominator = bx_minus_ax * dy_minus_cy - by_minus_ay * dx_minus_cx;
  const numerator1 = ay_minus_cy * dx_minus_cx - ax_minus_cx * dy_minus_cy;
  const numerator2 = ay_minus_cy * bx_minus_ax - ax_minus_cx * by_minus_ay;

  // Detect coincident lines
  if (denominator == 0) {
    return numerator1 == 0 && numerator2 == 0;
  }

  const r = numerator1 / denominator;
  const s = numerator2 / denominator;

  return r >= 0 && r <= 1 && s >= 0 && s <= 1;
};

// https://rosettacode.org/wiki/Shoelace_formula_for_polygonal_area#Lua
const calculatePolygonArea = (points) => {
  function det2(i, j) {
    return points[i].x * points[j].y - points[j].x * points[i].y;
  }
  let sum = points.length > 2 ? det2(points.length - 1, 0) : 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum = sum + det2(i, i + 1);
  }
  return Math.abs(0.5 * sum);
};

//Debug drawing functions
const drawWall = (p1, p2, minZ, maxZ, color, a) => {
  const bottomLeft = [p1.x, p1.y, minZ];
  const topLeft = [p1.x, p1.y, maxZ];
  const bottomRight = [p2.x, p2.y, minZ];
  const topRight = [p2.x, p2.y, maxZ];
  DrawPoly(...bottomLeft, ...topLeft, ...bottomRight, color[0], color[1], color[2], a);
  DrawPoly(...topLeft, ...topRight, ...bottomRight, color[0], color[1], color[2], a);
  DrawPoly(...bottomRight, ...topRight, ...topLeft, color[0], color[1], color[2], a);
  DrawPoly(...bottomRight, ...topLeft, ...bottomLeft, color[0], color[1], color[2], a);
};

// Grid creation functions
// Calculates the points of the rectangle that make up the grid cell at grid position (cellX, cellY)
const calculateGridCellPoints = (cellX, cellY, min, gridCellWidth, gridCellHeight) => {
  // min added to initial point, in order to shift the grid cells to the poly's starting position
  const x = cellX * gridCellWidth + min.x;
  const y = cellY * gridCellHeight + min.y;
  return [
    PolyVectorTools.vector2(x, y),
    PolyVectorTools.vector2(x + gridCellWidth, y),
    PolyVectorTools.vector2(x + gridCellWidth, y + gridCellHeight),
    PolyVectorTools.vector2(x, y + gridCellHeight),
    PolyVectorTools.vector2(x, y)
  ];
};

const pointInPoly = (point, range, poly) => {
  const { x, y, z } = point;
  const { x: minX, y: minY } = poly.min;
  const { x: maxX, y: maxY } = poly.max;
  const minZ = poly.minZ;
  const maxZ = poly.maxZ;
  const xDistance = Math.min(Math.abs(minX - x), Math.abs(maxX - x));
  const yDistance = Math.min(Math.abs(minY - y), Math.abs(maxY - y));
  let zDistance = 0;

  if (minZ && maxZ) {
    zDistance = Math.min(Math.abs(minZ - z), Math.abs(maxZ - z));
  } else if (minZ) {
    zDistance = Math.abs(minZ - z);
  } else if (maxZ) {
    zDistance = Math.abs(maxZ - z);
  }

  // Checks if point is within the polygon's bounding box
  if (x < minX || x > maxX || y < minY || y > maxY || (minZ && z < minZ) || (maxZ && z > maxZ)) {
    if (range) {
      return xDistance <= range && yDistance <= range && zDistance <= range;
    } else {
      return false;
    }
  }

  // Returns true if the grid cell associated with the point is entirely inside the poly
  const grid = poly.grid;
  if (grid) {
    const gridDivisions = poly.gridDivisions;
    const size = poly.size;
    const gridPosX = x - minX;
    const gridPosY = y - minY;
    const gridCellX = Math.floor((gridPosX * gridDivisions) / size.x);
    const gridCellY = Math.floor((gridPosY * gridDivisions) / size.y);
    let gridCellValue = grid[gridCellY + 1] && grid[gridCellY + 1][gridCellX + 1];
    if (!gridCellValue || poly.lazyGrid) {
      gridCellValue = poly.isGridCellInsidePoly(gridCellX, gridCellY, poly);
      grid[gridCellY + 1][gridCellX + 1] = gridCellValue;
    }
    if (gridCellValue) return true;
  }

  return windingNumber(point, poly.points);
};

class PolyZone {
  constructor(points, options) {
    if (!points) {
      console.log(`[PolyZone] Error: Passed null points table to PolyZone:Create() {name="${options.name}"}`);
      return;
    }
    if (points.length < 3) {
      console.log(`[PolyZone] Warning: Passed points table with less than 3 points to PolyZone:Create() {name="${options.name}"}`);
    }
    this.name = options.name || null;
    this.points = points;
    this.center = options.center;
    this.size = options.size;
    this.max = options.max;
    this.min = options.min;
    this.area = options.area;
    this.minZ = Number(options.minZ) * 1.0 || null;
    this.maxZ = Number(options.maxZ) * 1.0 || null;
    this.useGrid = options.useGrid || true;
    this.gridDivisions = Number(options.gridDivisions) || 25;
    this.debugColors = options.debugColors || {};
    this.debugPoly = options.debugPoly || false;
    this.debugGrid = options.debugGrid || false;
    this.debugBlip = options.debugBlip || false;
    this.lazyGrid = this.debugGrid ? false : options.lazyGrid || true;
    this.data = options.data || {};
    this.isPolyZone = true;
    this.lines = null;
    this.calculatePoly();
    this.initDebug();
  }

  addDebugBlip() {
    return addBlip(this.center || this.center);
  }

  initDebug() {
    if (this.debugBlip) {
      this.addDebugBlip();
    }

    const debugEnabled = this.debugPoly || this.debugGrid;
    if (!debugEnabled) {
      return;
    }

    const debugInterval = setInterval(() => {
      if (!this.destroyed) {
        this.draw();
        if (this.debugGrid && this.lines) {
          this.drawGrid();
        }
      } else {
        clearInterval(debugInterval);
      }
    }, 5);
  }

  isGridCellInsidePoly(cellX, cellY) {
    const gridCellPoints = calculateGridCellPoints(cellX, cellY, this.min, this.gridCellWidth, this.gridCellHeight);
    // Connect the polygon to its starting point
    const polyPoints = [...this.points, this.points[1]];
    // If none of the points of the grid cell are in the polygon, the grid cell can't be in it
    let isOnePointInPoly = false;
    for (let i = 0; i < gridCellPoints.length - 1; i++) {
      const cellPoint = gridCellPoints[i];
      const x = cellPoint.x;
      const y = cellPoint.y;
      if (windingNumber(cellPoint, this.points)) {
        isOnePointInPoly = true;
        // If we are drawing the grid (this.lines ~= nil), we need to go through all the points,
        // and therefore can't break out of the loop early
        if (this.lines) {
          if (!this.gridXPoints[x]) {
            this.gridXPoints[x] = {};
          }
          if (!this.gridYPoints[y]) {
            this.gridYPoints[y] = {};
          }
          this.gridXPoints[x][y] = true;
          this.gridYPoints[y][x] = true;
        } else {
          break;
        }
      }
    }

    if (!isOnePointInPoly) {
      return false;
    }

    //  If any of the grid cell's lines intersects with any of the polygon's lines
    //  then the grid cell is not completely within the poly
    for (let i = 0; i < gridCellPoints.length - 1; i++) {
      const gridCellP1 = gridCellPoints[i];
      const gridCellP2 = gridCellPoints[i + 1];
      for (let j = 0; j < polyPoints.length - 1; j++) {
        if (isIntersecting(gridCellP1, gridCellP2, polyPoints[j], polyPoints[j + 1])) {
          return false;
        }
      }
    }

    return true;
  }

  calculateLinesForDrawingGrid() {
    const lines = [];

    Object.entries(this.gridXPoints).forEach(([xValue, yTable]) => {
      const yValues = Object.keys(yTable);
      if (yValues.length >= 2) {
        yValues.sort();
        let minY = yValues[0];
        let lastY = yValues[0];
        yValues.forEach((yValue, index) => {
          if (yValue - lastY > this.gridCellHeight * 1.0) {
            lines.push({ min: PolyVectorTools.vector2(xValue, minY), max: PolyVectorTools.vector2(xValue, lastY) });
            minY = yValue;
          } else if (index == yValues.length - 1) {
            lines.push({ min: PolyVectorTools.vector2(xValue, minY), max: PolyVectorTools.vector2(xValue, yValue) });
          }
          lastY = yValue;
        });
      }
    });

    // Same as above, but for gridYPoints instead of gridXPoints
    Object.entries(this.gridYPoints).forEach(([yValue, xTable]) => {
      const xValues = Object.keys(xTable);
      if (xValues.length >= 2) {
        xValues.sort();
        let minX = xValues[0];
        let lastX = xValues[0];
        xValues.forEach((xValue, index) => {
          if (xValue - lastX > this.gridCellWidth * 1.0) {
            lines.push({ min: PolyVectorTools.vector2(minX, yValue), max: PolyVectorTools.vector2(lastX, yValue) });
            minX = xValue;
          } else if (index == xValues.length - 1) {
            lines.push({ min: PolyVectorTools.vector2(minX, yValue), max: PolyVectorTools.vector2(xValue, yValue) });
          }
          lastX = xValue;
        });
      }
    });

    return lines;
  }

  createGrid() {
    this.gridArea = 0.0;
    this.gridCellWidth = this.size.x / this.gridDivisions;
    this.gridCellHeight = this.size.y / this.gridDivisions;
    const isInside = {};
    const gridCellArea = this.gridCellWidth * this.gridCellHeight;
    for (let y = 1; y <= this.gridDivisions; y++) {
      isInside[y] = {};
      for (let x = 1; x <= this.gridDivisions; x++) {
        if (this.isGridCellInsidePoly(x - 1, y - 1)) {
          this.gridArea = this.gridArea + gridCellArea;
          isInside[y][x] = true;
        }
      }
    }
    this.grid = isInside;
    this.gridCoverage = this.gridArea / this.area;
    if (this.debugGrid) {
      const coverage = (this.gridCoverage * 100).toFixed(2);
      print(
        `[PolyZone] Debug: Grid Coverage at ${coverage}% with ${this.gridDivisions} divisions. Optimal coverage for memory usage and startup time is 80-90%`
      );
      this.lines = this.calculateLinesForDrawingGrid();
    }
  }

  calculatePoly() {
    if (!this.min || !this.max || !this.size || !this.center || !this.area) {
      let [minX, minY] = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
      let [maxX, maxY] = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
      this.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
      this.min = PolyVectorTools.vector2(minX, minY);
      this.max = PolyVectorTools.vector2(maxX, maxY);
      this.size = PolyVectorTools.diff2D(this.max, this.min);
      this.center = PolyVectorTools.midpoint2D(this.max, this.min);
      this.area = calculatePolygonArea(this.points);
    }

    this.boundingRadius = Math.sqrt(this.size.y * this.size.y + this.size.x * this.size.x) / 2;
    if (this.useGrid && !this.lazyGrid) {
      if (this.debugGrid) {
        this.gridXPoints = {};
        this.gridYPoints = {};
        this.lines = {};
      }
      this.createGrid();
    } else if (this.useGrid) {
      const isInside = {};
      for (let i = 1; i <= this.gridDivisions; i++) {
        isInside[i] = {};
      }
      this.grid = isInside;
      this.gridCellWidth = this.size.x / this.gridDivisions;
      this.gridCellHeight = this.size.y / this.gridDivisions;
    }
  }

  transformPoint(point) {
    return point;
  }

  draw() {
    const zDrawDist = 45.0;
    const oColor = this.debugColors.outline || defaultColorOutline;
    const wColor = this.debugColors.walls || defaultColorWalls;
    const plyPed = PlayerPedId();
    const plyPos = GetEntityCoords(plyPed);
    const minZ = (this.minZ || plyPos.z - zDrawDist) * 1.0;
    const maxZ = (this.maxZ || plyPos.z + zDrawDist) * 1.0;
    const points = this.points;

    points.forEach((currentPoint, index) => {
      const point = this.transformPoint(currentPoint);
      DrawLine(point.x, point.y, minZ, point.x, point.y, maxZ, oColor[0], oColor[1], oColor[2], 164);
      // If it is not last
      if (index < points.length - 1) {
        const p2 = this.transformPoint(points[index + 1]);
        DrawLine(point.x, point.y, maxZ, p2.x, p2.y, maxZ, oColor[0], oColor[1], oColor[2], 184);
        drawWall(point, p2, minZ, maxZ, wColor, 48);
      }
    });

    if (points.length > 2) {
      const firstPoint = this.transformPoint(points[0]);
      const lastPoint = this.transformPoint(points[points.length - 1]);
      DrawLine(firstPoint.x, firstPoint.y, maxZ, lastPoint.x, lastPoint.y, maxZ, oColor[0], oColor[1], oColor[2], 184);
      drawWall(firstPoint, lastPoint, minZ, maxZ, wColor, 48);
    }
  }

  drawPoly(poly) {
    this.draw(poly);
  }

  drawGrid() {
    let minZ = this.minZ;
    let maxZ = this.maxZ;
    if (!minZ || !maxZ) {
      const plyPed = PlayerPedId();
      const plyPos = GetEntityCoords(plyPed);
      minZ = plyPos.z - 46.0;
      maxZ = plyPos.z - 45.0;
    }
    const color = this.debugColors.grid || defaultColorGrid;

    this.lines.forEach((line) => {
      DrawLine(line.min.x, line.min.y, maxZ, line.max.x, line.max.y, maxZ, color[0], color[1], color[2], 196);
    });
  }

  isPointInside(point, range) {
    if (this.destroyed) {
      console.log(`[PolyZone] Warning: Called isPointInside on destroyed zone {name=${this.name}`);
      return false;
    }
    return pointInPoly(point, range, this);
  }

  destroy() {
    this.destroyed = true;
    if (this.debugPoly || this.debugGrid) {
      print(`[PolyZone] Debug: Destroying zone {name=${this.name}}`);
    }
  }

  // Helper functions
  getPlayerPosition() {
    const coords = GetEntityCoords(PlayerPedId());
    return PolyVectorTools.vector3(coords[0], coords[1], coords[2]);
  }

  getPlayerHeadPosition() {
    return GetPedBoneCoords(PlayerPedId(), HEAD_BONE);
  }

  onPointInOut(getPointCb, onPointInOutCb, range, waitInMS) {
    // Localize the waitInMS value for performance reasons (default of 500 ms)
    const _waitInMS = waitInMS || 500;
    let isInside = false;
    const interval = setInterval(() => {
      if (!this.destroyed) {
        if (!this.paused) {
          const point = getPointCb();
          const newIsInside = this.isPointInside(point, range);
          if (newIsInside !== isInside) {
            onPointInOutCb(newIsInside, point);
            isInside = newIsInside;
          }
        } else {
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
    }, _waitInMS);
  }

  onPlayerInOut(onPointInOutCb, waitInMS) {
    return this.onPointInOut(this.getPlayerPosition, onPointInOutCb, waitInMS);
  }

  onPlayerRangeInOut(onPointInOutCb, range, waitInMS) {
    return this.onPointInOut(this.getPlayerPosition, onPointInOutCb, range, waitInMS);
  }

  setPaused(paused) {
    this.paused = paused;
  }

  isPaused() {
    return this.paused;
  }

  getBoundingBoxMin() {
    return this.min;
  }

  getBoundingBoxMax() {
    return this.max;
  }

  getBoundingBoxSize() {
    return this.size;
  }

  getBoundingBoxCenter() {
    return this.center;
  }
}
