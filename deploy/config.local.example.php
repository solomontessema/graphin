<?php
// Graphin settings for this server. Edit the values below with the details IONOS shows for the Graphin database
// (IONOS control panel > Hosting > Databases). This file is a PHP file, so the web server never shows its contents.
//
// deploy.ps1 uploads this placeholder only once, the first time (with -FirstTime). After that it is never uploaded
// again, so what you type here on the server is kept when the app is updated.
return [
    'DB_HOST' => 'CHANGE_ME.hosting-data.io',
    'DB_PORT' => '3306',
    'DB_NAME' => 'CHANGE_ME',
    'DB_USER' => 'CHANGE_ME',
    'DB_PASS' => 'CHANGE_ME',
    'DB_CHARSET' => 'utf8mb4',
    // Set to 'true' only while fixing a problem: it shows error details in API responses.
    'APP_DEBUG' => 'false',
];
