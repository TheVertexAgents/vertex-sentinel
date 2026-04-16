#!/bin/bash
# Pre-process arguments to handle -o json
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) shift; shift ;;
    *) break ;;
  esac
done

COMMAND=$1
shift

# If command is 'paper', the actual command is the next argument
if [[ "$COMMAND" == "paper" ]]; then
    SUBCOMMAND=$1
    case "$SUBCOMMAND" in
        balance)
            echo '{"balances":{"ZUSD":{"available":100000.00,"reserved":0.0,"total":100000.00},"XXBT":{"available":0.5000,"reserved":0.0,"total":0.5000},"XETH":{"available":10.0000,"reserved":0.0,"total":10.0000},"SOL":{"available":100.0000,"reserved":0.0,"total":100.0000}},"mode":"paper"}'
            ;;
        history)
            echo '{"trades":[{"pair":"XXBTZUSD","price":50000.0,"cost":5000.0,"fee":0.1,"side":"buy","order_id":"O12345","time":"2026-04-16T09:00:00Z"}],"count":1}'
            ;;
        buy | sell)
            echo '{"action":"buy","order_id":"PAPER-12345","pair":"XXBTZUSD","price":50000.0,"volume":0.1,"cost":5000.0}'
            ;;
        *)
            echo "Unknown paper subcommand: $SUBCOMMAND" >&2
            ;;
    esac
else
    case "$COMMAND" in
      ticker)
        # Return all possible symbols to be safe
        echo '{
          "XXBTZUSD": {"a":["50010.0","1","1.000"],"b":["49990.0","1","1.000"],"c":["50000.0","0.1"],"v":["100","200"],"p":["50000.0","50000.0"],"t":[10,20],"l":["49990.0","49990.0"],"h":["50010.0","50010.0"],"o":"50000.0"},
          "BTCUSDC": {"a":["50010.0","1","1.000"],"b":["49990.0","1","1.000"],"c":["50000.0","0.1"],"v":["100","200"],"p":["50000.0","50000.0"],"t":[10,20],"l":["49990.0","49990.0"],"h":["50010.0","50010.0"],"o":"50000.0"},
          "XETHZUSD": {"a":["4000.0","1","1.000"],"b":["3999.0","1","1.000"],"c":["4000.0","0.1"],"v":["100","200"],"p":["4000.0","4000.0"],"t":[10,20],"l":["3999.0","3999.0"],"h":["4001.0","4001.0"],"o":"4000.0"},
          "ETHUSDC": {"a":["4000.0","1","1.000"],"b":["3999.0","1","1.000"],"c":["4000.0","0.1"],"v":["100","200"],"p":["4000.0","4000.0"],"t":[10,20],"l":["3999.0","3999.0"],"h":["4001.0","4001.0"],"o":"4000.0"},
          "SOLZUSD": {"a":["150.0","1","1.000"],"b":["149.0","1","1.000"],"c":["150.0","0.1"],"v":["100","200"],"p":["150.0","150.0"],"t":[10,20],"l":["149.0","149.0"],"h":["151.0","151.0"],"o":"150.0"},
          "SOLUSDC": {"a":["150.0","1","1.000"],"b":["149.0","1","1.000"],"c":["150.0","0.1"],"v":["100","200"],"p":["150.0","150.0"],"t":[10,20],"l":["149.0","149.0"],"h":["151.0","151.0"],"o":"150.0"}
        }'
        ;;
      balance)
        echo '{"ZUSD":"100000.00","XXBT":"0.5000","XETH":"10.0000","SOL":"100.0000"}'
        ;;
      trades-history)
        echo '{"trades":{"T12345":{"ordertxid":"O12345","pair":"XXBTZUSD","time":1700000000.0,"type":"buy","ordertype":"market","price":"48000.0","cost":"4800.0","fee":"7.68","vol":"0.1"}},"count":1}'
        ;;
      order | buy | sell)
        echo '{"txid":["O54321"],"descr":{"order":"buy 0.10000000 XBTUSD @ market"}}'
        ;;
      *)
        echo "Unknown command: $COMMAND" >&2
        ;;
    esac
fi
