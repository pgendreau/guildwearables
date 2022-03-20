#!/bin/sh

if [ $# != 2 ]; then
    echo "Usage: $0 <rarity> <number of results to display>"
    exit 1
fi

rarity=$1
number=$2

rarity_filter="select(.rarity == \"$rarity\")"
format_filter=".name + \": \" + (.owners | tostring)"
query=".[] | $rarity_filter | $format_filter"

node guildwearables.js | jq -r "$query" | head -n $number
