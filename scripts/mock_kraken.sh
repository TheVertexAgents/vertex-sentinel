#!/bin/bash

COMMAND=$1
shift

case "$COMMAND" in
  ticker)
    echo '{
      "XXBTZUSD": {
        "a": ["50010.0", "1", "1.000"],
        "b": ["49990.0", "1", "1.000"],
        "c": ["50000.0", "0.1"],
        "v": ["100", "200"],
        "p": ["50000.0", "50000.0"],
        "t": [10, 20],
        "l": ["49990.0", "49990.0"],
        "h": ["50010.0", "50010.0"],
        "o": "50000.0"
      },
      "ETHUSDC": {
        "a": ["4000.0", "1", "1.000"],
        "b": ["3999.0", "1", "1.000"],
        "c": ["4000.0", "0.1"],
        "v": ["100", "200"],
        "p": ["4000.0", "4000.0"],
        "t": [10, 20],
        "l": ["3999.0", "3999.0"],
        "h": ["4001.0", "4001.0"],
        "o": "4000.0"
      }
    }'
    ;;
  balance)
    echo '{
      "ZUSD": "100000.00",
      "XXBT": "0.5000",
      "XETH": "10.0000"
    }'
    ;;
  trades)
    echo '{
      "trades": {
        "T12345": {
          "ordertxid": "O12345",
          "pair": "XXBTZUSD",
          "time": 1700000000.0,
          "type": "buy",
          "ordertype": "market",
          "price": "48000.0",
          "cost": "4800.0",
          "fee": "7.68",
          "vol": "0.1"
        },
        "T12346": {
          "ordertxid": "O12346",
          "pair": "XXBTZUSD",
          "time": 1700000060.0,
          "type": "sell",
          "ordertype": "market",
          "price": "51000.0",
          "cost": "5100.0",
          "fee": "13.26",
          "vol": "0.1"
        }
      },
      "count": 2
    }'
    ;;
  order)
    echo '{
      "txid": ["O54321"],
      "descr": {
        "order": "buy 0.10000000 XBTUSD @ market"
      }
    }'
    ;;
  *)
    echo "Unknown command: $COMMAND" >&2
    ;;
esac
