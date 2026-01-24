## gradually introducing channels

as a participant,

- when I join a room, on-screen instructions guide me through a tutorial sequence that I complete by demonstrating an understanding of the two kinds of motion input
- when I start the tutorial _while the room is in its regular state_ (i.e. no one is in tutorial)
  - other participants' channels return to their initial state (equivalent to `frontToBack: 0` and `around: 0`) are prompted to wait for me to complete the tutorial
  - _LOW PRIORITY_: the room visuals change to assist me in completing the tutorial, offering additional visual feedback for the two kinds of motion input, and encouraging me not to look at my screen
- when I start the tutorial _while another participant is in the tutorial_
  - I am prompted to wait for that participant to finish the tutorial
- when I press the "skip" button during the tutorial, the tutorial stops.
- when I complete/skip the tutorial, the room returns to its regular state
- when I am disconnected from the tutorial, the tutorial ends and the room goes back to its regular state

### groundwork for tutorial mode

- on server:
  1.  respond to TUTORIAL_START, TUTORIAL END (i.e. relay to other participants)
  2.  add state to keep track of:
      - the queue of users in tutorial mode
      - what tutorial step the user is in
- in index route (motion input client):
  1.  add state to keep track of:
      - the queue of users in tutorial mode
      - what tutorial step the user is in
      - (note: this may already be implemented via changes to `roomState`)
  2.  implement "skip" button to leave tutorial mode
  3.  show wait prompt to non-tutorial users
  4.  stop sending events from non-tutorial users
  5.  send WebSocket messages TUTORIAL_START, TUTORIAL_END
  6.  add overlays onto WebGL visuals (squares over target region of screen, circles over target regions around orb), and callbacks for control to be passed to tutorial component
- in `/listen` route:
  1.  add state to keep track of:
      - whether any user is in tutorial mode
      - what tutorial step the user is in
  2.  stop responding to motion input events except from tutorial user
  3.  turn channel input parameters `frontToBack` and `around` down to zero for channels of users other than tutorial user

### the tutorial

#### `Intro` component and hooks

The tutorial state will be managed in the index route, using a `useTutorial` hook, which will take parameters for:

- any data needed from `roomState`
- current user identifier, to determine if
- `onProgress`, in which the WebSockets utility `handleMessage` will be used to communicate tutorial actions to the server
  The `useTutorial` hook will return these values for use in the `Intro` component.
- the tutorial state (users queue, current step identifier)
- `progress(step: TutorialStepName)`
- `skip()`
  Besides the `useTutorial` values, the `Intro` component will take any props needing to be passed down to the `TutorialStep`s. Inside, the correct `TutorialStep` will be selected from a `Record<TutorialStepName, TutorialStep>`.

The `TutorialStep`s will be objects having properties:

- name - a string union `TutorialStepName`
- component - a React functional component that renders the prompts + visual cues for a given step, taking
  - the `useTutorial` values
  - `orientationControl`, which is an object with `{frontToBack:number, around:number}` that is updated on motion input

Basic steps:

- Learn `frontToBack` control
- Learn `around` control

#### `frontToBack` control:

1. Tilt your phone like this to move the orb up and down.
   - show an illustration of the movement
   - they tap "OK"
2. Move the orb to the top of the screen. Hold it there until the screen fully lights up.
   - show a target space to keep the orb inside
   - show the illustration again if it takes a second
   - wait for them to hold `frontToBack: 100` ±7 for 2 bars
3. Nice! Now move the orb to the bottom of the screen. Hold it there until the screen fully lights up.
   - same as above but with `frontToBack: 0`±7
4. Nice! Let's try some rhythmic back-and-forth motion.
   - same as above but in a repeating up/down x 3, 2 bars in each position
5. Now move the orb to the middle of the screen.
   - same as above but with `frontToBack: 50`±7
6. Nice! Let's try some more gradual motions.
   - same as the back-and-forth step, but now up/middle/down x 3 at 2 bars each, then x 3

#### `around` control

1. With the orb glowing bright, point your phone left and right to make the little orbs spin around. You can turn your whole body if you want!
   - show an illustration of the movement
   - they tap "OK"
2. Now, with the orb glowing bright, turn your arm/body so the orbs are aligned vertically. Hold it there...
   - show the target space for the two little orbs (above/below the main orb, and moving with it)
   - show the illustration again if it takes a second
   - wait for them to hold `around: 100` ±7 for 2 bars
3. Nice! Now, with your arm still out, turn your arm/body so the orbs are aligned horizontally. Hold it there...
   - same as above but with `around: 0`±7
4. Nice! Let's try some rhythmic back-and-forth motion.
   - analogous
5. Now move the orbs so that they are aligned diagonally.
   - same as above but with `around: 0`±7
6. Nice! Let's try some more gradual motions.
   - analogous
7. That's it! Now you're ready to make music.
   - they tap "OK"
