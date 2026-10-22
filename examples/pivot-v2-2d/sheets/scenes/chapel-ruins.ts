/** chapel-ruins: the whole scene as one reference image. */

import { defineSceneAsset } from '@core/volume';
import { SCENERY } from '../../src/scenery/catalog';
import { SCENE } from '../../src/scenes/chapel-ruins';

export default defineSceneAsset({ catalog: SCENERY, scene: SCENE });
