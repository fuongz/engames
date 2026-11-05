#!/usr/bin/env bash
# Generates Mèo Vũ Trụ source art with the Codex CLI. Usage: bash tools/meo-vu-tru-art.sh [name ...]
# (no names = all). Writes art-src/meo-vu-tru/<name>.png (git-ignored); tools/meo-vu-tru-sprites.py
# processes them. The ship, the five enemy cats, fish, bone, orb and the chapter-1 boss come from the
# approved samples in art-src/samples/meo/ (sheet.png, boss.png) and are not regenerated here.
mkdir -p "$(dirname "$0")/../art-src/meo-vu-tru"
cd "$(dirname "$0")/../art-src/meo-vu-tru" || exit 1
HEAD='Use your image generation tool to generate ONE image, then save it as PNG to ./NAME.png in the current working directory (copy/convert the generated file there). Do not create or modify any other files.
STRICT: original designs only. No chickens, no eggs, nothing from '"'"'Chicken Invaders'"'"' or any existing franchise (no Nyan Cat, Hello Kitty, Doraemon, Pokémon).
STYLE: match the attached reference images exactly — cheerful bold-outline cartoon, thick dark outlines, bright saturated colours, clean cel shading, readable at small size on a phone.'

brief() {
  case "$1" in
    ufos) echo 'BRIEF: a sprite sheet of FOUR separate objects in ONE row, evenly spaced with wide gaps, on a flat pure magenta (#ff00ff) background, no text, no shadows on the background. Each is a cute alien cat head inside a clear glass bubble dome sitting on a small round flying saucer, seen from the front, identical size and pose, saucer with little round lights and a glowing yellow thruster underneath: (1) TEAL-green cat on a blue saucer with a star emblem, (2) PURPLE cat on a purple saucer with a moon emblem, (3) ORANGE tabby cat on a yellow saucer with a paw emblem, (4) PINK cat on a pink saucer with a heart emblem. Same family as the bubble-UFO cats in the reference scene. Each object fills most of its cell.' ;;
    pickups) echo 'BRIEF: a sprite sheet of FIVE separate objects in ONE row, evenly spaced with wide gaps, on a flat pure magenta (#ff00ff) background, no text, no shadows. (1) a RED round tin can of cat food standing upright, slightly tilted, with a pull-tab lid on top and a big yellow three-way spreading arrows symbol on its label beside a small fish silhouette, (2) the SAME can in BLUE with a bright white-cyan straight laser beam symbol on the label, (3) the SAME can in GREEN with a yellow lightning bolt symbol on the label, (4) a small chunky red-and-white cartoon missile rocket pointing UP with a fish-tail fin and a tiny flame, (5) a big glossy red cartoon heart. No ribbons, no bows, no gift boxes. Each object fills most of its cell.' ;;
    boss2) echo 'BRIEF: a chapter BOSS on a flat pure magenta (#ff00ff) background, no text, centred, seen from the front/slightly above: a GIANT angular ROBOT CAT mech (NOT round, NOT blue: gunmetal-grey and bright ORANGE armour plates with black hazard stripes and bolts, a square jaw, glowing red visor eyes, pointy robot ears with antennae, a small grumpy alien grey tabby cat pilot visible in a glass cockpit on its forehead, two chunky mechanical arms with three-finger claws, and a big yarn-ball launcher cannon on its chest loaded with a pink ball of yarn. Menacing but cute. Same style family as the reference boss.' ;;
    boss3) echo 'BRIEF: a chapter BOSS on a flat pure magenta (#ff00ff) background, no text, centred, seen from the front/slightly above: a regal alien CAT QUEEN (fluffy white-and-lilac long-haired cat with a small golden crown and a purple cape, smug expression) riding on top of a huge battleship shaped like a stylised fish facing DOWN toward the viewer — teal and gold hull with fin-shaped wings left and right, porthole windows, two side turrets and a big glowing mouth cannon at the bottom. Menacing but cute. Same style family as the reference boss.' ;;
    bg) echo 'BRIEF: a portrait 9:16 vertical game background, no characters, no objects except planets, no text, no UI: deep blue-purple outer space with a soft purple nebula haze, many small twinkling stars of different sizes, ONE large purple cratered planet partly cut off at the left edge in the lower half, one small blue ringed planet at the right edge. The top and bottom edges should look similar (calm star field) so the picture can scroll vertically and repeat. Keep it calm and low-contrast in the middle so sprites stay readable.' ;;
    poster) echo 'BRIEF: a portrait 3:4 key-art illustration for the game, no text, no logo, no UI. A chunky red-and-yellow rocket fighter with a paw emblem flies up from the bottom centre firing glowing orange bolts; above it, a swarm of cute alien cats in bubble-helmet mini UFOs (teal, purple, orange, pink), an orange jetpack cat and a black cat with a ray gun, and dried fish tumbling through space; at the top, a grumpy cat captain on a giant cat-food-can mothership with claw arms. Deep blue-purple starry space with planets. Leave the bottom 25% as calm dark space (a title will be placed there).' ;;
    banner) echo 'BRIEF: a wide 2:1 landscape key-art illustration, no text, no logo, no UI. Composition: everything interesting on the RIGHT 55%; the LEFT 45% is calm plain deep blue-purple starry space (a title will be placed there). Right side: the SAME player ship as in the reference sheet (a chunky red-and-yellow rocket fighter, no visible pilot, seen from behind pointing UP, paw emblem) firing glowing orange bolts UPWARD at a group of cute alien cats in bubble-helmet mini UFOs (teal, purple, orange, pink) and a grumpy cat captain on a giant cat-food-can mothership; dried fish float around.' ;;
  esac
}

ref() {
  case "$1" in
    ufos|bg) echo "../samples/meo/scene.png" ;;
    boss2|boss3) echo "../samples/meo/boss.png" ;;
    poster|banner) echo "../samples/meo/scene.png" ;;
    *) echo "../samples/meo/sheet.png" ;;
  esac
}

names=("$@")
[ ${#names[@]} -eq 0 ] && names=(ufos pickups boss2 boss3 bg poster banner)
for n in "${names[@]}"; do
  printf '%s\n\n%s\n' "${HEAD//NAME/$n}" "$(brief "$n")" > "prompt-$n.txt"
  /opt/homebrew/bin/codex exec -C "$PWD" -s workspace-write --skip-git-repo-check \
    -i "$(ref "$n")" -i ../samples/meo/sheet.png - < "prompt-$n.txt" > "log-$n.txt" 2>&1 &
done
wait
ls -la ./*.png
