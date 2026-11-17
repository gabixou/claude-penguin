===== FRAME 1 =====
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
var SHELL = _global.getCurrentShell();
var INTERFACE = _global.getCurrentInterface();
SHELL.addListener(SHELL.UPDATE_COINS,handleUpdateCoins);
stop();

===== FRAME 2 =====
showCoins();
secret_btn.tabEnabled = false;

