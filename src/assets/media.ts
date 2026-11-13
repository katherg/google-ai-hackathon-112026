import mayaAndLeoAvatarUrl from './images/maya_and_leo_avatar_1794598334462.jpg';
import homeCalmSanctuaryUrl from './images/home_calm_sanctuary_1794598335658.jpg';
import learnBabyConnectionUrl from './images/learn_baby_connection_1794598336564.jpg';
import stageThirdTrimesterUrl from './images/stage_third_trimester_1794606016452.jpg';
import stageNewbornUrl from './images/stage_newborn_1794606016943.jpg';
import stageTwoMonthsUrl from './images/stage_two_months_1794606017297.jpg';
import stageFiveMonthsUrl from './images/stage_five_months_1794606019023.jpg';
import stageNineMonthsUrl from './images/stage_nine_months_1794606018264.jpg';
import { BabyStageImageKey } from '../types';

export const APP_IMAGES = {
  mayaAvatar: mayaAndLeoAvatarUrl,
  homeSanctuary: homeCalmSanctuaryUrl,
  learnConnection: learnBabyConnectionUrl,
};

export const STAGE_IMAGES: Record<BabyStageImageKey, string> = {
  'prenatal-trimester-3': stageThirdTrimesterUrl,
  newborn: stageNewbornUrl,
  'month-1-2': stageTwoMonthsUrl,
  'month-3': learnBabyConnectionUrl,
  'month-4-6': stageFiveMonthsUrl,
  'month-7-12': stageNineMonthsUrl,
};
