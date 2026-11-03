<?php

return [
    'dakar' => [
        'bounds' => [
            'south' => (float) env('DAKAR_SOUTH_BOUND', 14.55),
            'north' => (float) env('DAKAR_NORTH_BOUND', 14.85),
            'west' => (float) env('DAKAR_WEST_BOUND', -17.55),
            'east' => (float) env('DAKAR_EAST_BOUND', -17.10),
        ],
    ],
];