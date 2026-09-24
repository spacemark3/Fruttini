import * as THREE from 'three';
import { Fruttino } from './Fruttino.js';
import { FruitPulp } from './FruitPulp.js';
import { WaterDrops } from './WaterDrops.js';
import { SugarCrystals } from './SugarCrystals.js';
import { ScoopSpoon } from './ScoopSpoon.js';
import { OrangeFruit } from './OrangeFruit.js';
import { StillLifeStage } from './StillLifeStage.js';

/** Every 3D element of the story, updated from the same story state. */
export class StoryWorld {
  constructor(scene) {
    this.root = new THREE.Group();
    this.fruttino = new Fruttino();
    this.pulp = new FruitPulp();
    this.water = new WaterDrops();
    this.sugar = new SugarCrystals();
    this.scoop = new ScoopSpoon();
    this.orange = new OrangeFruit();
    this.stage = new StillLifeStage();
    this.root.add(
      this.stage.group,
      this.fruttino.group,
      this.pulp.group,
      this.water.group,
      this.sugar.group,
      this.scoop.group,
      this.orange.group,
    );
    scene.add(this.root);
  }

  update(s, p) {
    this.fruttino.update(s);
    this.pulp.update(s);
    this.water.update(s, p);
    this.sugar.update(s, p);
    const f = this.fruttino;
    this.scoop.update(s, {
      top: { mesh: f.top.mesh, faceMat: f.faceMat },
      bottom: { mesh: f.bottom.mesh, faceMat: f.bottomFaceMat },
    }, p);
    this.orange.update(s);
    this.stage.update(s, this.fruttino.group.position.y);
  }
}
