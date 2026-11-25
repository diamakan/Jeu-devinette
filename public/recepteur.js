// Récepteur Chromecast : reçoit le code du salon envoyé par le téléphone qui caste.
(function () {
  const ESPACE_CAST = 'urn:x-cast:fr.croquizz';
  const ctxCast = cast.framework.CastReceiverContext.getInstance();
  ctxCast.addCustomMessageListener(ESPACE_CAST, (e) => {
    const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d && d.salon) window.rejoindreSalon(d.salon);
  });
  const options = new cast.framework.CastReceiverOptions();
  options.disableIdleTimeout = true;   // le Chromecast ne s'éteint pas pendant la partie
  options.customNamespaces = { [ESPACE_CAST]: cast.framework.system.MessageType.JSON };
  ctxCast.start(options);
  activerSon();                         // sur Chromecast le son marche sans clic
})();
