import { getRouteApi } from '@tanstack/react-router';

/** Typed access to the project's asset list route from any component below it. */
export const assetsRoute = getRouteApi('/p/$project/');

export const playgroundRoute = getRouteApi('/p/$project/playground');

export const customizeRoute = getRouteApi('/p/$project/customize');

export const sceneryRoute = getRouteApi('/p/$project/scenery');
