'use strict';

// Import the Dialogflow module from the Actions on Google client library.
const {dialogflow, SignIn} = require('actions-on-google');

// Import the firebase-functions package for deployment.
const admin = require('firebase-admin');
const functions = require('firebase-functions');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const app = dialogflow({
  // REPLACE THE PLACEHOLDER WITH THE CLIENT_ID OF YOUR ACTIONS PROJECT
  clientId: "",
  debug: true
});

let prevSpeech = "";

function choose(choices) {
  var index = Math.floor(Math.random() * choices.length);
  return choices[index];
}

// Create a Dialogflow intent with the `actions_intent_SIGN_IN` event.
app.intent('Get Signin', async (conv, params, signin) => {
  if (signin.status === 'OK') {
    conv.user.storage.userPayload = conv.user.profile.payload;
    //conv.ask("Emial: "+conv.user.storage.userPayload.email);
    const dialogflowAgentRef = await db.collection('users').doc(conv.user.storage.userPayload.email);

    var userValues = {
      name: conv.user.storage.userPayload.name,
      orders: [],
    };
    await dialogflowAgentRef.set(userValues);
    prevSpeech = `Kaydınız başarıyla gerçekleşti. Size nasıl yardımcı olabilirim?`;
    conv.ask(`Kaydınız başarıyla gerçekleşti. Size nasıl yardımcı olabilirim?`);

  } else {
    prevSpeech = `. Sipariş verme özelliği dışında ki özellikleri size sunabilirim. Örneğin, bir bölgedeki restoranları size sayabilirim.`;
    conv.ask(`. Sipariş verme özelliği dışında ki özellikleri size sunabilirim. Örneğin, bir bölgedeki restoranları size sayabilirim.`);

  }
});

app.intent('Default Welcome Intent', async (conv) => {
    var userPayload = conv.user.storage.userPayload;
    //conv.user.storage = {};
    userPayload = false;
    if(!userPayload){
      conv.ask("Merhaba, Ne Vereyim Abime'ye hoş geldin, Senin için yemek siparişi verebilir" +
      ", ve resteronlar hakkında bilgi verebilirim. Siparişlerini yapman için kayıt olman gerekiyor, kayıt olmak ister misin?");
    }
    else{
      const WELCOME_TEXTS = [
        'Merhaba'+conv.user.storage.userPayload.name+ ", sana nasıl yardımcı olabilirim?",
        'Selam'+conv.user.storage.userPayload.name+ ", bugün senin için ne yapabilirim?",
        'Hoşgeldin'+conv.user.storage.userPayload.name+ ", ne istersin?",
        'Merhaba'+conv.user.storage.userPayload.name+ ", bugün hangi isteğini yerine getirebilirim?",
        'Merhaba'+conv.user.storage.userPayload.name+ ", senin için ne yapabilirim?",
     ]
      conv.ask(choose(WELCOME_TEXTS));
    }
    
});

app.intent('Default Welcome Intent - yes', async (conv) => {
  conv.ask(new SignIn());
}); 

app.intent('repeat-last-order', async (conv) => {
  var response = "";
  const dbRef = await db.collection("users").doc(conv.user.storage.userPayload.email);
  return dbRef.get().then(doc => {
    response += "Son siparişinde ";

    console.log(doc.data()["orders"]);
    for (let i = 0; i < doc.data()["orders"]['1'].length; i++) {
      response += doc.data()["orders"]['1'][i];
    }
    response += " son adresini mi kullanmak istersen yoksa adres defterinden başka bir adres mi kullanmak istersin?";
    prevSpeech = response;
    conv.ask(response);
  });
  
});

// Similarity Function
function isSimilarEnough(s1, s2) {
  var min = Math.min(s1.length, s2.length);
  var max = Math.max(s1.length, s2.length);
  var ok = 0;
  for (var i = 0; i < min; i++) {
    if (s2.charAt(i) == s1.charAt(i)) ok++;
  }
  if (ok / s1.length >= 0.5) return true;
  return false;
}

function isRestaurantSimilarEnough(s1, s2){
     var res1 = s1.split(" ");
     var res2 = s2.split(" ");
     var ok = 0 ;
     var min = Math.min(res1.length, res2.length);
     for(var i =0; i < min; i++){
       if(isSimilarEnough(res1[i], res2[i]  )) ok ++;
     }

     if(ok/min>= 0.5) return true;
     return false;
}

/*
app.intent('take-order-free', async (conv, {foodName,foodType,restaurantName}) => {
  if(restaurantName || conv.user.data.selectedRestId){


    if(foodType){
      var resp = "Seçenekler arasında ";
      var foods = await db.collection("restaurant").doc(conv.data.selectedRestId);
      return foods.get().then(doc => {
        var prodMap =  doc.data()["productTypeList"];
          for (var key in prodMap) {
            if (isSimilarEnough(String(key), foodType)) {
              let i = 4;
              for (var food in prodMap[key]) {
                if (i <= 0) break;
                response += String(food) + ", ";
              }
              break;
            }
          }
          conv.user.data.foodType = foodType;
          conv.ask(resp + " var, hangisini sipariş etmek istersin?");
      });
    }
    else if(foodName){
      if(conv.user.data.foodType){
        var resp = "Seçenekler arasında ";
        var foods = await db.collection("restaurant").doc(conv.data.selectedRestId);
        return foods.get().then(doc => {
          var prodMap =  doc.data()["productTypeList"];
            for (var key in prodMap) {
                let i = 4;
                for (var food in prodMap[key]) {
                  if (i <= 0) break;
                  if(isSimilarEnough(String(food), foodName)){
                    resp = foodName;
                  }
                  
                }
                break;
            }
            conv.user.data.selectedFood = resp;
            conv.ask(resp + " ürününü spariş listenize ekledim. Başka bir şey ister misiniz?");
        });
      }
      
    }
    else{
      var response = restaurantName + " 'da ";
      var rests = await db.collection("restaurant");
      return rests.get().then(snapshot => {
        snapshot.forEach(doc => {
          if (isSimilarEnough(doc.data()['restaurantName'], restaurantName)) {
            conv.data.selectedRestId = doc.id;
            let i = 4;
            var prodMap =  doc.data()["productTypeList"];
            for (var key in prodMap) {
              if (i <= 0) break;
              response += String(key) + ", ";
              i--;
            }
        }
          
        });
        response += " var.";
        conv.ask(response + "Ne sipariş vermek istersin?");
      });
    }
  }else{
    conv.ask("Nerden sipariş vermek istersiniz?");
  }
  
});*/

app.intent('get-eta', async (conv, {restaurantName}) => {
  if (!restaurantName && conv.data.selectedRestId) {
    var rest = await db.collection("restaurant").doc(conv.data.selectedRestId);
    return rest.get().then(doc => {
      prevSpeech = doc.data()["restaurantName"] + " dakikada siparişini getirebilir, Başka yardımcı olabileceğim bir şey var mı?"; 
      conv.ask(doc.data()["restaurantName"] + " dakikada siparişini getirebilir, Başka yardımcı olabileceğim bir şey var mı?");
    });
  }
  else if (restaurantName && !conv.data.selectedRestId) {

  }
  var resp = restaurantName + " ortalama ";
  var rests = await db.collection("restaurant");
  return rests.get().then(snapshot => {
    snapshot.forEach(doc => {
      if (isSimilarEnough(doc.data()['restaurantName'], restaurantName)) {   
        prevSpeech = String(doc.data()['DeliveryTime']) + " dakikada siparişini getirebilir, Başka yardımcı olabileceğim bir şey var mı?"; 
       resp += String(doc.data()['DeliveryTime']) + " dakikada siparişini getirebilir, Başka yardımcı olabileceğim bir şey var mı?";
    }
    });
    conv.ask(resp);
  });
});

app.intent("take-final-order", async (conv, {restaurantName, foodName}) => {
  console.log(foodName);
  var order = {}
;  var rests = await db.collection("restaurant");
  return rests.get().then(snapshot => {
    var isValidRest = false;
    var isValidFood = false;
    snapshot.forEach(doc => {
      if (isSimilarEnough(doc.data()['restaurantName'], restaurantName)) {
        isValidRest = true;
        for (var i in foodName) {
          var prodMap =  doc.data()["productTypeList"];
          for (var key in prodMap) {
            
            for (var food in prodMap[key]) {
              //console.log(food);
              //console.log(foods);
              if(isSimilarEnough(String(food), foodName[i])) {
                  isValidFood = true;
                  order = {price : prodMap[key][food]};
              }
            }
          }
        }
      }
      
    });
    if (isValidFood && isValidRest) {
      order['restName'] = restaurantName;
      order['foods'] = foodName;
      conv.data.order = order;
      prevSpeech = "Siparişin hazırlanıyor, afiyet olsun :), bu siparişi kaydetmek istiyor musun?";
      conv.ask("Siparişin hazırlanıyor, afiyet olsun :), bu siparişi kaydetmek istiyor musun?");
      
    } else {
      const FALLBACK_TEXTS = ["Bahsettiğin restoranı veya yemekleri anlayamadım",
                              "Restoran veya yemek ismini anlayamadım, lütfen tekrar eder misin?",
                            "Söylemek istediğin restoran veya yemek adını anlayamadım, lütfen tekrar eder misin?"]
      console.log(isValidFood);
      console.log(isValidRest);
      conv.ask(choose(FALLBACK_TEXTS));
    }
  });
});

app.intent('take-final-order - yes', async (conv) => {
  console.log(conv.data.order);
  var dbRef = await db.collection("users").doc(conv.user.storage.userPayload.email);
  return dbRef.get().then(doc => {
    var orderList = doc.data()['orders'];
    orderList.push(conv.data.order);
    console.log(orderList);
    dbRef.update({"orders" : orderList});
    conv.close("Kayıt başarıyla gerçekleşti");
  });
  
});

app.intent('what-restaurant-do', async (conv, {restaurantName}) => {
  var response = restaurantName + " 'da ";
  var rests = await db.collection("restaurant");
  return rests.get().then(snapshot => {
    snapshot.forEach(doc => {
      if (isRestaurantSimilarEnough(doc.data()['restaurantName'], restaurantName)) {
        conv.data.selectedRestId = doc.id;
        let i = 4;
        var prodMap =  doc.data()["productTypeList"];
        for (var key in prodMap) {
          if (i <= 0) break;
          response += String(key) + ", ";
          i--;
        }
    }
      
    });
    response += " var.";
    prevSpeech =response + "Ne sipariş vermek istersin?";
    conv.ask(response + "Ne sipariş vermek istersin?");
  });

});

app.intent('no_input', (conv) => {
  const repromptCount = parseInt(conv.arguments.get('REPROMPT_COUNT'));
  if (repromptCount === 0) {
  conv.ask(`Bir şey mi söyledin?`);
  } else if (repromptCount === 1) {
  conv.ask(`Dediğini duyamadım. Tekrar söyler misin?`);
  } else if (conv.arguments.get('IS_FINAL_REPROMPT')) {
  conv.close(`Üzgünüm, lütfen daha sonra tekrar dene.`);
  }
});

app.intent('Repeat', (conv) => {
  conv.ask(new SimpleResponse({
     speech:prevSpeech,
     text: prevSpeech
   }));
 });

// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
