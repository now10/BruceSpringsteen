// AE
var ae_js;
var ae_member = '';
var sme_legacy_player_track_name = '';
var sme_legacy_player_service_name = '';

function AEJSReady( _aeJS ) {
	ae_js = _aeJS;
	ae_js.settings.auth_window = true;
	ae_js.settings.mobile_detect = false;
	ae_js.settings.services = 'spotify,deezer';
	ae_js.settings.extra_fields_screen = 'disabled';
	ae_js.settings['scopes'] = {
		spotify: 'playlist-modify-private playlist-modify-public playlist-read-collaborative playlist-read-private user-follow-modify user-follow-read user-library-modify user-library-read user-read-email user-read-private user-read-recently-played user-top-read streaming user-modify-playback-state'
	};
	ae_js.events.onLogin.addHandler( window.AEJSStreamingAudioPlayerLoginHandler );
	ae_js.events.onUser.addHandler( window.AEJSStreamingAudioPlayerUserHandler );
}


window.onSpotifyWebPlaybackSDKReady = function () {
	console.log( 'Spotify Web SDK ready.' );
};

(
	function ( $ ) {
		var global_volume = 100;
		var global_service = 'none';
		var save_service = 'none';
		var global_current_track;
		var audios = $( '.lsap-track audio' );
		var spotify_player;
		var spotify_device_id;
		var apple_clicked;

		function configSaveModal( button ) {
			var apple_music_id = button.attr( 'data-apple-id' );
			var deezer_id = button.attr( 'data-deezer-id' );
			var spotify_uri = button.attr( 'data-spotify-uri' );

			$( '#save-popup .save-btns>a' ).hide();

			if ( apple_music_id ) {
				$( '#save-popup .save-btns>a[data-service="apple_music"]' ).show();
			}

			if ( deezer_id ) {
				$( '#save-popup .save-btns>a[data-service="deezer"]' ).show();
			}

			if ( spotify_uri ) {
				$( '#save-popup .save-btns>a[data-service="spotify"]' ).show();
			}

		}

		function toggleModal( id, action ) {
			if ( action === 'open' ) {
				$( 'body' ).addClass( 'legacy-modal-open' );
				$( id ).show();
			} else {
				$( 'body' ).removeClass( 'legacy-modal-open' );
				$( id ).hide();
			}
		}

		function infoModal( apple ) {
			var info_modal_shown = Cookies.get( 'info_modal_shown' );
			if ( typeof info_modal_shown === 'undefined' ) {
				if ( apple ) {
					toggleModal( '#apple-premium-popup', 'open' );
				} else {
					toggleModal( '#spotify-premium-popup', 'open' );
				}

				Cookies.set( 'info_modal_shown', global_service, { expires: 30 } );
			}
		}

		function initSpotifyPlayer( token ) {
			spotify_player = new Spotify.Player( {
				name: 'Legacy Spotify Web Player',
				getOAuthToken: function ( cb ) {
					cb( token );
				}
			} );

			// Error handling
			spotify_player.addListener( 'initialization_error', function ( message ) {
				console.error( message );
				toggleModal( '#spotify-free-popup', 'open' );
			} );
			spotify_player.addListener( 'authentication_error', function ( message ) {
				console.error( message );
			} );
			spotify_player.addListener( 'account_error', function ( message ) {
				console.error( message );
			} );
			spotify_player.addListener( 'playback_error', function ( message ) {
				console.error( message );
			} );

			// Playback status updates
			spotify_player.addListener( 'player_state_changed', function ( state ) {
				console.log( state );
			} );

			// Ready
			spotify_player.addListener( 'ready', function ( device ) {
				spotify_device_id = device.device_id;
				console.log( 'Ready with Device ID', device.device_id );
				infoModal();
			} );

			// Not Ready
			spotify_player.addListener( 'not_ready', function ( device ) {
				console.log( 'Device ID has gone offline', device.device_id );
			} );

			// Connect to the player!
			spotify_player.connect();

			setInterval( function () {
				if ( $( '.legacy-streaming-audio-player.active' ).length > 0 ) {
					spotify_player.getCurrentState().then( function ( state ) {
						if ( state !== null ) {
							var progress = $( '.legacy-streaming-audio-player.active .lsap-progress' );
							progress.find( '.lsap-progress-duration-current' ).text( formatTime( state.position / 1000 ) );
							progress.find( '.lsap-progress-bar>div' ).css( 'width', (
								                                                        state.position / 1000
							                                                        ) / (
								                                                        state.duration / 1000
							                                                        ) * 100 + '%' );
							global_current_track.find( '.lsap-track-progress' ).css( 'width', (
								                                                                  state.position / 1000
							                                                                  ) / (
								                                                                  state.duration / 1000
							                                                                  ) * 100 + '%' );
						}
					} ).catch( onPromiseError );
				}
			}, 1000 );
		}

		// Deezer Init
		DZ.init( {
			appId: '226382',
			channelUrl: lsap_wp.deezer_channel_url,
			player: {
				onload: function () {
				}
			}
		} );

		// Musickit
		MusicKit.configure( {
			developerToken: lsap_wp.apple_music_jwt,
			app: {
				name: 'Sony Music Entertainment',
				icon: 'https://cdn.smehost.net/formssonymusicfanscom-appirioprod/wp-content/uploads/2018/10/Sony_Music_logo_logotype3.png'
			}
		} );

		var apple_music = MusicKit.getInstance();

		// Load if previous player
		var service = getPlayerCookie();
		if ( service === 'apple_music' ) {
			if ( apple_music.isAuthorized === true ) {
				infoModal( true );
				setActivePlayer( service );
			}
		}

		// Spotify
		var spotify_api = new SpotifyWebApi();

		// Promise Error Handler
		function onPromiseError( ex ) {
			console.log( 'global service: ' + global_service );
			console.log( 'error message:' );
			console.log( ex );

			// Spotify premium alert
			if ( typeof ex.responseText !== 'undefined' ) {
				if ( ex.responseText.includes( 'PREMIUM_REQUIRED' ) ) {
					toggleModal( '#spotify-free-popup', 'open' );
				}
			}
		}

		// AE Login Handler
		function AEJSStreamingAudioPlayerLoginHandler( user, type, sso ) {
			ae_member = user;
			SMFOptIn( user, null, null, lsap_wp.smf.ae_activities_default );

			for ( var s = 0; s < user.services.length; s ++ ) {
				if ( user.services[s].Service === 'spotify' ) {
					if ( typeof Spotify !== 'undefined' ) {
						spotify_api.setAccessToken( user.services[s].Token );
						initSpotifyPlayer( user.services[s].Token );
						var is_firefox = navigator.userAgent.toLowerCase().indexOf( 'firefox' ) > - 1;
						var is_android = navigator.platform.toLowerCase().indexOf( 'android' ) > - 1;

						if ( is_firefox && is_android ) {
							toggleModal( '#spotify-free-popup', 'open' );
						}
					} else {
						alert( 'The Spotify API has not yet loaded. Please try again in a few moments.' );
					}
					break;
				}

				if ( user.services[s].Service === 'deezer' ) {
					DZ.token = user.services[s].Token;
					DZ.ready( {
						token: {
							access_token: user.services[s].Token
						}
					} );
					//DZ.init();
					break;
				}
			}
			$( '.legacy-streaming-audio-player' ).removeClass( 'lsap-logged-out' ).addClass( 'lsap-logged-in' );
		}

		window.AEJSStreamingAudioPlayerLoginHandler = AEJSStreamingAudioPlayerLoginHandler;

		// AE User Handler
		function AEJSStreamingAudioPlayerUserHandler( user, state ) {
			if ( state === 'init' ) {
				ae_member = user;
				SMFOptIn( user, null, null, lsap_wp.smf.ae_activities_default );
				var service = getPlayerCookie();
				for ( var s = 0; s < user.services.length; s ++ ) {
					if ( user.services[s].Service === 'spotify' ) {
						if ( service === 'spotify' ) {
							$.ajax( {
								url: lsap_wp.ajax_url,
								method: 'POST',
								dataType: 'json',
								data: {
									action: 'ae_refresh_spotify_token',
									security: lsap_wp.spotify_nonce,
									ae_service_id: user.services[s].ID
								},
								error: function () {
									alert( 'Error refreshing Spotify tokens!' );
								},
								success: function ( response ) {
									if ( response.success ) {
										var spotify_loaded = setInterval( function () {
											if ( typeof Spotify !== 'undefined' ) {
												var ae_data = JSON.parse( response.data );
												spotify_api.setAccessToken( ae_data.AccessToken );
												initSpotifyPlayer( ae_data.AccessToken );
												setActivePlayer( service );
												clearInterval( spotify_loaded );
											}
										}, 1000 );
									} else {
										alert( 'Error refreshing Spotify tokens!' );
									}
								}
							} );
						}
						break;
					}

					if ( user.services[s].Service === 'deezer' ) {
						if ( service === 'deezer' ) {
							DZ.token = user.services[s].Token;
							DZ.ready( {
								token: {
									access_token: user.services[s].Token
								}
							} );
							//DZ.init();
						}
						break;
					}
				}
			}
		}

		window.AEJSStreamingAudioPlayerUserHandler = AEJSStreamingAudioPlayerUserHandler;

		function SMFOptIn( user, apple_token, apple_email, ae_activities ) {
			var data = {
				field_email_address: typeof user !== 'undefined' && user !== null ? user.data.Email : apple_email,
				field_first_name: typeof user !== 'undefined' && user !== null ? user.data.FirstName : '',
				field_last_name: typeof user !== 'undefined' && user !== null ? user.data.Surname : '',
				ae: lsap_wp.smf.ae,
				ae_member_id: typeof user !== 'undefined' && user !== null ? user.data.ID : '',
				ae_brand_id: lsap_wp.smf.ae_brand_id,
				ae_segment_id: lsap_wp.smf.ae_segment_id,
				ae_activities: ae_activities,
				form: lsap_wp.smf.form_id,
				default_mailing_list: lsap_wp.smf.default_mailing_list
			};

			if ( typeof apple_token !== 'undefined' && apple_token !== null ) {
				data.am_music_user_token = apple_token;
			}

			$.ajax( {
				url: 'https://subs.sonymusicfans.com/submit',
				method: 'POST',
				dataType: 'json',
				data: data,
				xhrFields: {
					withCredentials: false
				},
				error: function () {
					console.log( 'SMF form submission error' );
				},
				success: function () {
					console.log( 'SMF form submission successful' );
				}
			} );
		}

		DZ.Event.subscribe( 'player_position', function ( pos ) {
			var progress = $( '.legacy-streaming-audio-player.active .lsap-progress' );
			progress.find( '.lsap-progress-duration-current' ).text( formatTime( pos[0] ) );
			progress.find( '.lsap-progress-bar>div' ).css( 'width', pos[0] / pos[1] * 100 + '%' );

			global_current_track.find( '.lsap-track-progress' ).css( 'width', pos[0] / pos[1] * 100 + '%' );
		} );

		// Format Time
		function formatTime( time ) {
			if ( !Number.isNaN( time ) ) {
				return new Date( time * 1000 ).toISOString().substr( 11, 8 ).substr( 3 );
			} else {
				return '0:00';
			}
		}

		// Stop other players when switching services
		function stopOtherPlayers() {
			switch ( global_service ) {
				case 'apple_music':
					if ( DZ.player.loaded !== false ) {
						DZ.player.pause();
					}
					audios.trigger( 'pause' );
					if ( typeof spotify_player !== 'undefined' ) {
						spotify_player.pause().then().catch( onPromiseError );
					}
					break;
				case 'deezer':
					apple_music.player.pause();
					audios.trigger( 'pause' );
					if ( typeof spotify_player !== 'undefined' ) {
						spotify_player.pause().then().catch( onPromiseError );
					}
					break;
				case 'spotify':
					apple_music.player.pause();
					if ( DZ.player.loaded !== false ) {
						DZ.player.pause();
					}
					audios.trigger( 'pause' );
					break;
				case 'none':
					apple_music.player.pause();
					if ( DZ.player.loaded !== false ) {
						DZ.player.pause();
					}
					if ( typeof spotify_player !== 'undefined' ) {
						spotify_player.pause().then().catch( onPromiseError );
					}
				default:
					break;
			}
		}

		// Check if a service is authorized
		function isAuthed( service ) {
			var promise = new Promise( function ( resolve, reject ) {
				var timer;
				var iterations = 30;
				switch ( service ) {
					case 'apple_music':
						sme_legacy_player_service_name = 'apple_music';
						break;
					case 'deezer':
						sme_legacy_player_service_name = 'deezer';
						if ( typeof DZ.token !== 'undefined' && DZ.token !== null ) {
							save_service = 'deezer';
							resolve( true );
						} else {
							ae_js.trigger.authenticate( 'deezer', 'register' );
							timer = setInterval( function () {
								if ( iterations > 60 ) {
									clearInterval( timer );
									reject( 'Timed Out' );
								}
								if ( typeof DZ.token !== 'undefined' && DZ.token !== null ) {
									clearInterval( timer );
									save_service = 'deezer';
									resolve( true );
								}
							}, 1000 );
						}
						break;
					case 'spotify':
						sme_legacy_player_service_name = 'spotify';
						if ( spotify_api.getAccessToken() !== null ) {
							global_service = 'spotify';
							save_service = 'spotify';
							resolve( true );
						} else {
							ae_js.trigger.authenticate( 'spotify', 'register' );
							timer = setInterval( function () {
								if ( iterations > 60 ) {
									clearInterval( timer );
									reject( 'Timed Out' );
								}
								if ( spotify_api.getAccessToken() !== null ) {
									clearInterval( timer );
									global_service = 'spotify';
									save_service = 'spotify';
									resolve( true );
								}
							}, 1000 );
						}
					/*default:
						console.log( 'resolved at bottom?' );
						resolve( true );
						break;*/
				}
			} );
			return promise;
		}

		function getPlayerCookie() {
			var service = Cookies.get( 'legacy_player_selected' );

			if ( typeof service === 'undefined' ) {
				service = 'none';
			}

			return service;
		}

		function setPlayerCookie() {
			Cookies.set( 'legacy_player_selected', global_service, { expires: 30 } );
		}

		// Set Track Duration Info
		function updateTrackDurations() {
			$( '.legacy-streaming-audio-player' ).each( function () {
				var self = $( this );
				var tracks = $( this ).find( '.lsap-track' );
				var now_playing_title = $( this ).find( '.lsap-now-playing-title' ).text();

				tracks.each( function () {
					var audio_duration = $( this ).attr( 'data-duration' );
					var title = $( this ).attr( 'data-title' );
					var audio_el_duration = formatTime( $( this ).find( 'audio' )[0].duration );
					if ( global_service === 'none' /*&& audio_el_duration !== '0:00'*/ ) {
						//audio_duration = audio_el_duration;
						audio_duration = '00:30';
					}
					$( this ).find( '.lsap-track-duration' ).text( audio_duration );
					if ( now_playing_title === title ) {
						self.find( '.lsap-progress-duration-total' ).text( audio_duration );
					}
				} );
			} );
		}

		function setActivePlayer( service ) {
			global_service = service;
			sme_legacy_player_service_name = global_service;
			$( '.lsap-stream-service-selection>ul>li>button' ).removeClass( 'active' );
			$( '.lsap-stream-service-selection>ul>li>button[data-service=' + service + ']' ).addClass( 'active' );
			updateTrackDurations();
			$( '.legacy-streaming-audio-player' ).removeClass( 'lsap-logged-out' ).addClass( 'lsap-logged-in' );
		}

		function StreamingAudioPlayer( element, options ) {
			var $element = $( element );
			var all_elements = $( '.legacy-streaming-audio-player' );
			var local_audios = $element.find( '.lsap-track audio' );
			var play_pause_button = $element.find( '.lsap-play-progress .lsap-play-controls .lsap-play-controls-play-pause' );
			var progress = $element.find( '.lsap-progress' );
			var volume_bars = $( '.lsap-volume-control-bar>div' );
			var all_tracks = $( '.lsap-track' );
			var last_playing = $element.find( '.lsap-track:nth-child(2)' );

			updatePlayerInfo();
			updateTrackDurations();

			// Update Player Info
			function updatePlayerInfo( track ) {

				var track = typeof track !== 'undefined' && track !== null ? track : last_playing;

				// Update player info
				$element.find( '.lsap-now-playing-artist' ).text( track.attr( 'data-artist' ) );
				$element.find( '.lsap-now-playing-title' ).text( track.attr( 'data-title' ) );

				if ( global_service === 'none' ) {
					var audio_duration = formatTime( $element.find( 'audio' )[0].duration );
					$element.find( '.lsap-progress-duration-total' ).text( audio_duration );
				} else {
					$element.find( '.lsap-progress-duration-total' ).text( track.attr( 'data-duration' ) );
				}

				var artwork = $element.find( '.lsap-artwork' );
				var image = track.attr( 'data-image' );

				if ( image !== '' ) {
					artwork.html( '<img src="' + image + '" alt="' + track.attr( 'data-title' ) + '" />' );
				} else {
					artwork.empty();
				}
			}

			// Toggle play/pause button icon
			function togglePlayButton( el, state ) {
				all_tracks.each( function () {
					$( this ).find( 'i:nth-child(1)' ).show();
					$( this ).find( 'i:nth-child(2)' ).hide();
				} );
				if ( state === 'play' ) {
					el.find( 'i:nth-child(1)' ).hide();
					el.find( 'i:nth-child(2)' ).show();
					play_pause_button.find( 'i:nth-child(1)' ).hide();
					play_pause_button.find( 'i:nth-child(2)' ).show();
				} else {
					el.find( 'i:nth-child(1)' ).show();
					el.find( 'i:nth-child(2)' ).hide();
					play_pause_button.find( 'i:nth-child(1)' ).show();
					play_pause_button.find( 'i:nth-child(2)' ).hide();
				}
			}

			// Show stream service popup
			function showStreamCTAPopup( el ) {
				var top = el.position().top;
				var popup = $element.find( '.lsap-stream-popup' );

				console.log( $( el ).attr( 'data-apple-id' ) );

				if ( $( el ).attr( 'data-apple-id' ) ) {
					popup.find( '.lsap-stream-service-selection>ul>li:first-child' ).show();
				} else {
					popup.find( '.lsap-stream-service-selection>ul>li:first-child' ).hide();
				}

				if ( $( el ).attr( 'data-spotify-uri' ) ) {
					popup.find( '.lsap-stream-service-selection>ul>li:last-child' ).show();
				} else {
					popup.find( '.lsap-stream-service-selection>ul>li:last-child' ).hide();
				}

				popup.css( 'top', top - popup.outerHeight() + 10 ).fadeIn();
				setTimeout( function () {
					popup.fadeOut();
				}, 8000 );
			}

			// Login Service Buttons
			$element.find( '.lsap-stream-service-selection>ul>li>button' ).on( 'click', function ( e ) {
				e.preventDefault();
				var service = $( this ).attr( 'data-service' );
				$( '.lsap-stream-service-selection>ul>li>button' ).removeClass( 'active' );
				$( '.lsap-stream-service-selection>ul>li>button[data-service=' + service + ']' ).addClass( 'active' );

				if ( service === 'apple_music' ) {
					sme_legacy_player_service_name = 'apple_music';
					var apple_email = Cookies.get( 'legacy_player_apple_email' );
					if ( typeof apple_email === 'undefined' || apple_email === '' || apple_email === null ) {
						toggleModal( '#apple-music-popup', 'open' );
						apple_clicked = $element;
					} else {
						apple_music.authorize().then( function () {
							infoModal( true );
							SMFOptIn( null, apple_music.musicUserToken, apple_email, lsap_wp.smf.ae_activities_default );
							var apple_music_id = last_playing.attr( 'data-apple-id' );
							apple_music.api.song( apple_music_id ).then( function ( song ) {
								apple_music.setQueue( { url: song.attributes.url } ).then( function ( queue ) {
								} );
							} );
							global_service = 'apple_music';
							save_service = 'apple_music';
							updateTrackDurations();
							setPlayerCookie();
						} );
					}
				} else {
					isAuthed( service ).then( function () {
						console.log( 'global service: ' + global_service );
						console.log( 'authenticated' );
						updateTrackDurations();
						setPlayerCookie();
					} ).catch( onPromiseError );
				}
			} );

			// Play / Pause
			play_pause_button.on( 'click', function ( e ) {
				e.preventDefault();
				last_playing.find( '.lsap-track-controls .lsap-track-controls-play-pause' ).trigger( 'click' );
				global_current_track = last_playing;
			} );

			// Prev
			$element.find( '.lsap-play-progress .lsap-play-controls .lsap-play-controls-prev' ).on( 'click', function ( e ) {
				e.preventDefault();
				var prev_track = last_playing.prev( '.lsap-track' );
				if ( prev_track.length === 0 ) {
					prev_track = last_playing.siblings( '.lsap-track' ).last();
				}
				prev_track.find( '.lsap-track-controls .lsap-track-controls-play-pause' ).trigger( 'click' );
				global_current_track = prev_track;
			} );

			// Next
			$element.find( '.lsap-play-progress .lsap-play-controls .lsap-play-controls-next' ).on( 'click', function ( e ) {
				e.preventDefault();
				var next_track = last_playing.next( '.lsap-track' );
				if ( next_track.length === 0 ) {
					next_track = last_playing.siblings( '.lsap-track' ).first();
				}
				next_track.find( '.lsap-track-controls .lsap-track-controls-play-pause' ).trigger( 'click' );
				global_current_track = next_track;
			} );

			// Mute
			$element.find( '.lsap-info-volume .lsap-volume-controls .lsap-volume-control-mute' ).on( 'click', function ( e ) {
				e.preventDefault();
				global_volume = 0;
				volume_bars.css( 'width', '0%' );
				audios.prop( 'volume', 0 );
				apple_music.player.mute();
				DZ.player.setVolume( 0 );
				if ( typeof spotify_player !== 'undefined' ) {
					spotify_player.setVolume( 0 ).then().catch( onPromiseError );
				}
			} );

			// Volume Bar
			$element.find( '.lsap-volume-control-bar' ).on( 'click', function ( e ) {
				e.preventDefault();
				var click_width = e.pageX - $( this ).position().left;
				var per = (
					click_width / $( this ).width()
				);
				var rounded_per = Math.round( per * 100 ) / 100;

				if ( rounded_per > 1 ) {
					rounded_per = 1;
				} else if ( rounded_per < 0 ) {
					rounded_per = 0;
				}
				volume_bars.css( 'width', rounded_per * 100 + '%' );
				audios.prop( 'volume', rounded_per );
				apple_music.player.volume = rounded_per;
				DZ.player.setVolume( rounded_per * 100 );
				if ( typeof spotify_player !== 'undefined' ) {
					spotify_player.setVolume( rounded_per ).then().catch( onPromiseError );
				}
			} );

			// Maximum Volume
			$element.find( '.lsap-info-volume .lsap-volume-controls .lsap-volume-control-max' ).on( 'click', function ( e ) {
				e.preventDefault();
				global_volume = 100;
				volume_bars.css( 'width', '100%' );
				audios.prop( 'volume', global_volume / 100 );
				apple_music.player.volume = 1;
				DZ.player.setVolume( global_volume );
				if ( typeof spotify_player !== 'undefined' ) {
					spotify_player.setVolume( 1 ).then().catch( onPromiseError );
				}
			} );

			// Track Play / Pause
			$element.find( '.lsap-tracks .lsap-track .lsap-track-controls .lsap-track-controls-play-pause' ).on( 'click', function ( e ) {
				e.preventDefault();
				all_elements.removeClass( 'active' );
				$element.addClass( 'active' );
				var track = $( this ).parents( '.lsap-track' );
				var self = $( this );

				updatePlayerInfo( track );
				sme_legacy_player_track_name = track.attr( 'data-title' );
				// Stop other players
				stopOtherPlayers();
				switch ( global_service ) {
					case 'apple_music':
						sme_legacy_player_service_name = 'apple_music';
						var apple_music_id = track.attr( 'data-apple-id' );
						if ( apple_music_id ) {
							apple_music.authorize().then( function () {
								infoModal( true );
								// Progress - not sure why this only works here
								apple_music.addEventListener( MusicKit.Events.playbackProgressDidChange, function ( event ) {
									var progress = $( '.legacy-streaming-audio-player.active .lsap-progress' );
									progress.find( '.lsap-progress-duration-current' ).text( formatTime( apple_music.player.currentPlaybackTime ) );
									progress.find( '.lsap-progress-bar>div' ).css( 'width', event.progress * 100 + '%' );
									global_current_track.find( '.lsap-track-progress' ).css( 'width', event.progress * 100 + '%' );
								} );
								if ( track[0] === last_playing[0] && !apple_music.player.queue.isEmpty ) {
									if ( !apple_music.player.isPlaying ) {
										apple_music.player.play();
										togglePlayButton( self, 'play' );
									} else {
										apple_music.player.pause();
										togglePlayButton( self, 'pause' );
									}
								} else {
									apple_music.api.song( apple_music_id ).then( function ( song ) {
										apple_music.setQueue( { url: song.attributes.url } ).then( function ( queue ) {
											apple_music.player.play();
											togglePlayButton( self, 'play' );
										} );
									} );
								}
								global_service = 'apple_music';
								save_service = 'apple_music';
								last_playing = track;
							} );
						}
						break;
					case 'deezer':
						sme_legacy_player_service_name = 'deezer';
						var deezer_id = track.attr( 'data-deezer-id' );
						if ( deezer_id ) {
							isAuthed( 'deezer' ).then( function () {
								// Check if playing, and also if it's the same track to avoid starting it over
								if ( track[0] === last_playing[0] ) {
									if ( typeof DZ.player.isPlaying() === 'undefined' ) {
										DZ.player.playTracks( [deezer_id] );
										togglePlayButton( self, 'play' );
									} else if ( DZ.player.isPlaying() === false ) {
										DZ.player.play();
										togglePlayButton( self, 'play' );
									} else {
										DZ.player.pause();
										togglePlayButton( self, 'pause' );
									}
								} else {
									DZ.player.playTracks( [deezer_id] );
									togglePlayButton( self, 'play' );
								}
								last_playing = track;
							} ).catch( onPromiseError );
						}
						break;
					case 'spotify':
						sme_legacy_player_service_name = 'spotify';
						var spotify_uri = track.attr( 'data-spotify-uri' );
						if ( spotify_uri ) {
							isAuthed( 'spotify' ).then( function () {
								spotify_player.getCurrentState().then( function ( state ) {
									if ( state === null || state.track_window.current_track.uri !== spotify_uri ) {
										spotify_api.play( {
											device_id: spotify_device_id,
											uris: [spotify_uri]
										} ).then( function () {
											togglePlayButton( self, 'play' );
											last_playing = track;
										} ).catch( onPromiseError );
									} else if ( state.paused === false ) {
										spotify_player.pause().then( function () {
											togglePlayButton( self, 'pause' );
										} ).catch( onPromiseError );
									} else {
										spotify_player.resume().then( function () {
											togglePlayButton( self, 'play' );
										} ).catch( onPromiseError );
									}
								} ).catch( onPromiseError );
							} ).catch( onPromiseError );
						}
						break;
					default:
					case 'none':
						var track_audio = track.find( 'audio' );
						if ( track_audio[0].paused ) {
							audios.trigger( 'pause' );
							track_audio[0].play();
							togglePlayButton( self, 'play' );
							showStreamCTAPopup( track );
						} else {
							track_audio[0].pause();
							togglePlayButton( self, 'pause' );
						}
						last_playing = track;
						break;
				}
				global_current_track = track;
			} );

			// Progress Bar
			local_audios.bind( 'timeupdate', function () {
				var audio_el = $( this )[0];
				progress.find( '.lsap-progress-duration-current' ).text( formatTime( audio_el.currentTime ) );
				progress.find( '.lsap-progress-bar>div' ).css( 'width', audio_el.currentTime / audio_el.duration * 100 + '%' );
				global_current_track.find( '.lsap-track-progress' ).css( 'width', audio_el.currentTime / audio_el.duration * 100 + '%' );
			} );
		}

		$.fn.streamingAudioPlayer = function ( options ) {
			return this.each( function () {
				new StreamingAudioPlayer( this );
			} );
		};

		$( document ).ready( function () {
			$( '.legacy-streaming-audio-player' ).streamingAudioPlayer();

			$( '.lsap-popup' ).on( 'click', function ( e ) {
				e.preventDefault();
				var href = $( this ).attr( 'href' );
				var h = 475;
				var w = 500;
				var y = window.top.outerHeight / 2 + window.top.screenY - (
					h / 2
				);
				var x = window.top.outerWidth / 2 + window.top.screenX - (
					w / 2
				);
				return window.open( href, 'Legacy Streaming Audio Player', `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${w}, height=${h}, top=${y}, left=${x}` );
			} );

			$( '#apple-music-popup-close' ).on( 'click', function ( e ) {
				e.preventDefault();
				toggleModal( '#apple-music-popup', 'close' );
			} );

			$( '#save-close' ).on( 'click', function ( e ) {
				e.preventDefault();
				toggleModal( '#save-popup', 'close' );
			} );

			$( '#spotify-free-popup-close' ).on( 'click', function ( e ) {
				e.preventDefault();
				toggleModal( '#spotify-free-popup', 'close' );
			} );

			$( '#spotify-premium-popup-close' ).on( 'click', function ( e ) {
				e.preventDefault();
				toggleModal( '#spotify-premium-popup', 'close' );
			} );

			$( '#apple-premium-popup-close' ).on( 'click', function ( e ) {
				e.preventDefault();
				toggleModal( '#apple-premium-popup', 'close' );
			} );

			$( '#apple-music-form' ).on( 'submit', function ( e ) {
				e.preventDefault();
				var apple_email = $( '#apple_email_address' ).val();
				if ( apple_email ) {
					Cookies.set( 'legacy_player_apple_email', apple_email, { expires: 30 } );
					toggleModal( '#apple-music-popup', 'close' );
					if ( save_ele_clicked === null ) {
						apple_clicked.find( '.lsap-stream-service-selection>ul>li>button[data-service="apple_music"]' ).trigger( 'click' );
					} else {
						$( '#save-popup .save-btns>a[data-service="apple_music"]' ).trigger( 'click' );
					}
				}
			} );

			var save_ele_clicked = null;
			$( '#save-popup .save-btns>a' ).on( 'click', function ( e ) {
				e.preventDefault();
				var service = $( this ).attr( 'data-service' );
				save_service = service;
				switch ( service ) {
					case 'apple_music':
						var apple_email = Cookies.get( 'legacy_player_apple_email' );
						if ( typeof apple_email === 'undefined' || apple_email === '' || apple_email === null ) {
							toggleModal( '#apple-music-popup', 'open' );
						} else {
							/*apple_music.authorize().then( function () {
								SMFOptIn( null, apple_music.musicUserToken, apple_email, lsap_wp.smf.ae_activities_default );
								global_service = 'apple_music';
								save_service = 'apple_music';
								updateTrackDurations();
								setPlayerCookie();
								save_ele_clicked.trigger( 'click' );
							} );*/
							save_ele_clicked.trigger( 'click' );
						}
						break;
					default:
						isAuthed( service ).then( function () {
							save_ele_clicked.trigger( 'click' );
						} ).catch( onPromiseError );
						break;
				}
				toggleModal( '#save-popup', 'close' );
			} );

			$( '.lsap-track-save, .lsap-tracks .lsap-track .lsap-library-add' ).on( 'click', function ( e ) {
				e.preventDefault();
				sme_legacy_player_track_name = $( this ).parents( '.lsap-track' ).attr( 'data-title' );
				if ( save_service === 'none' ) {
					configSaveModal( $( this ) );
					toggleModal( '#save-popup', 'open' );
					save_ele_clicked = $( this );
				} else {
					save_ele_clicked = null;
					switch ( save_service ) {
						case 'none':
							alert( 'Please sign into a service.' );
							break;
						case 'apple_music':
							sme_legacy_player_service_name = 'apple_music';
							if ( $( this ).hasClass( 'lsap-library-add' ) ) {
								var apple_music_id = $( this ).parents( '.lsap-track' ).attr( 'data-apple-id' );
							} else {
								var apple_music_id = $( this ).attr( 'data-apple-id' );
							}
							if ( apple_music_id && apple_music_id !== '' ) {
								apple_music.authorize().then( function () {
									infoModal( true );
									apple_music.api.addToLibrary( {
										albums: [apple_music_id]
									} ).then( function () {
										var apple_email = Cookies.get( 'legacy_player_apple_email' );
										SMFOptIn( null, apple_music.musicUserToken, apple_email, lsap_wp.smf.ae_activities_apple_music_save_track );
										alert( 'Track saved!' );
									} ).catch( onPromiseError );
								} ).catch( onPromiseError );
							} else {
								alert( 'Unable to save - Apple Music ID is missing for this content.' );
							}
							break;
						case 'deezer':
							sme_legacy_player_service_name = 'deezer';
							if ( $( this ).hasClass( 'lsap-library-add' ) ) {
								var deezer_id = $( this ).parents( '.lsap-track' ).attr( 'data-deezer-id' );
							} else {
								var deezer_id = $( this ).attr( 'data-deezer-id' );
							}

							if ( deezer_id && deezer_id !== '' ) {
								isAuthed( 'deezer' ).then( function () {
									DZ.api( '/user/me/tracks', 'POST', { track_id: deezer_id }, function ( response ) {
										SMFOptIn( ae_member, null, null, lsap_wp.smf.ae_activities_deezer_save_track );
										alert( 'Track saved!' );
									} );
								} ).catch( onPromiseError );
							} else {
								alert( 'Unable to save - Deezer ID is missing for this content.' );
							}
							break;
						case 'spotify':
							sme_legacy_player_service_name = 'spotify';
							if ( $( this ).hasClass( 'lsap-library-add' ) ) {
								var spotify_uri = $( this ).parents( '.lsap-track' ).attr( 'data-spotify-uri' );
							} else {
								var spotify_uri = $( this ).attr( 'data-spotify-uri' );
							}

							if ( spotify_uri && spotify_uri !== '' ) {
								isAuthed( 'spotify' ).then( function () {
									spotify_api.addToMySavedTracks( [spotify_uri.replace( 'spotify:track:', '' )] ).then( function () {
										SMFOptIn( ae_member, null, null, lsap_wp.smf.ae_activities_spotify_save_track );
										alert( 'Track saved!' );
									} ).catch( onPromiseError );
								} ).catch( onPromiseError );
							} else {
								alert( 'Unable to save - Spotify ID is missing for this content.' );
							}
							break;
						case 'none':
						default:
							break;
					}
				}
			} );

			$( '.lsap-album-save' ).on( 'click', function ( e ) {
				e.preventDefault();

				if ( save_service === 'none' ) {
					configSaveModal( $( this ) );
					toggleModal( '#save-popup', 'open' );
					save_ele_clicked = $( this );
				} else {
					save_ele_clicked = null;
					switch ( save_service ) {
						case 'none':
							alert( 'Please sign into a service.' );
							break;
						case 'apple_music':
							var apple_music_id = $( this ).attr( 'data-apple-id' );
							if ( apple_music_id && apple_music_id !== '' ) {
								apple_music.authorize().then( function () {
									infoModal( true );
									apple_music.api.addToLibrary( {
										albums: [apple_music_id]
									} ).then( function () {
										var apple_email = Cookies.get( 'legacy_player_apple_email' );
										SMFOptIn( null, apple_music.musicUserToken, apple_email, lsap_wp.smf.ae_activities_apple_music_save_album );
										alert( 'Album saved!' );
									} ).catch( onPromiseError );
								} ).catch( onPromiseError );
							} else {
								alert( 'Unable to save - Apple Music ID is missing for this content.' );
							}
							break;
						case 'deezer':
							var deezer_id = $( this ).attr( 'data-deezer-id' );
							if ( deezer_id && deezer_id !== '' ) {
								isAuthed( 'deezer' ).then( function () {
									DZ.api( '/user/me/albums', 'POST', { album_id: deezer_id }, function ( response ) {
										SMFOptIn( ae_member, null, null, lsap_wp.smf.ae_activities_deezer_save_album );
										alert( 'Album saved!' );
									} );
								} ).catch( onPromiseError );
							} else {
								alert( 'Unable to save - Deezer ID is missing for this content.' );
							}
							break;
						case 'spotify':
							var spotify_uri = $( this ).attr( 'data-spotify-uri' );
							if ( spotify_uri && spotify_uri !== '' ) {
								isAuthed( 'spotify' ).then( function () {
									spotify_api.addToMySavedAlbums( [spotify_uri.replace( 'spotify:album:', '' )] ).then( function () {
										SMFOptIn( ae_member, null, null, lsap_wp.smf.ae_activities_spotify_save_album );
										alert( 'Album saved!' );
									} ).catch( onPromiseError );
								} ).catch( onPromiseError );
							} else {
								alert( 'Unable to save - Spotify ID is missing for this content.' );
							}
							break;
						case 'none':
						default:
							break;
					}
				}
			} );
		} );

		// ADA
		$( window ).load(function() {
			$( '#dzplayer' ).attr( 'tabindex', '-1' ).attr( 'aria-hidden', 'true' );
			$( 'iframe[src*="https://sdk.scdn.co/embedded/index.html"]' ).attr( 'tabindex', '-1' ).attr( 'aria-hidden', 'true' );
		});
	}
)
( jQuery );
