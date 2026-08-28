export type AnimationState =
  | 'idle'
  | 'idle2'
  | 'idle3'
  | 'idle4'
  | 'idle5'
  | 'walk'
  | 'run'
  | 'runToStop'
  | 'jump'
  | 'fallingIdle'
  | 'hardLanding'
  | 'fallingToRoll'
  | 'crouchEnter'
  | 'crouchEnter2'
  | 'crouchExit'
  | 'crouchExitMoving'
  | 'crouchSneakLeft'
  | 'crouchSneakRight'
  | 'coverSneakLeft'
  | 'coverSneakRight'
  | 'punch'
  | 'kick'
  | 'hit'
  | 'bigHit';

export const IDLE_VARIANTS: AnimationState[] = ['idle', 'idle2', 'idle3', 'idle4', 'idle5'];
export const CROUCH_HOLD_VARIANTS: AnimationState[] = ['crouchEnter', 'crouchEnter2'];

export type ViewMode = 'first' | 'third';

export interface MovementInputs {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
  crouch: boolean;
  punch: boolean;
  kick: boolean;
  interact: boolean;
  parry: boolean;
}
