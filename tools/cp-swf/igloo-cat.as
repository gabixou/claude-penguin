MAIN:
== f1 ==
function handleUpdateCoins(ob)
{
   var _loc1_ = ob.coins;
   coinTotal.coins_txt.text = "YOUR COINS: " + _loc1_;
}
function showCoins()
{
   var _loc1_ = SHELL.getMyPlayerTotalCoins();
   handleUpdateCoins({coins:_loc1_});
}
stop();
var SHELL = _global.getCurrentShell();
var INTERFACE = _global.getCurrentInterface();
SHELL.addListener(SHELL.UPDATE_COINS,handleUpdateCoins);

== f2 ==
showCoins();

== f8 ==
function candyTruth()
{
   if(candy1 == true && candy2 == true && candy3 == true && candy4 == true)
   {
      secret.nextFrame();
   }
}
candy1 = false;
candy2 = false;
candy3 = false;
candy4 = false;

== f9 ==
showCoins();

== f10 ==
showCoins();

== SPR 78 f1 ==
_parent.showCoins();

== SPR 130 f1 ==
stop();

== SPR 299 f1 ==
stop();

== SPR 318 f1 ==
stop();

