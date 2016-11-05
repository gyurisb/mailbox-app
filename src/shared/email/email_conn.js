const BrowserBox = require('browserbox');
const SmtpClient = require('wo-smtpclient');
const MimeParser = require('emailjs-mime-parser');
const semaphore = require('semaphore');

module.exports = EmailConnection;

function EmailConnection() {
	var imap;
	var imapLock = semaphore(1);
	var sender;
	var password;
	var smtpHost;
	var smtpPort;
	var selectedFolder;
	return {
		login: function(arg, success, error) {
			imapLock.take(function() {
				imap = new BrowserBox(arg.imapHost, arg.imapPort, {
					auth: {
						user: arg.username,
						pass: arg.password
					},
					id: {
						name: 'My Client',
						version: '0.1'
					}
				});
				imap.onauth = function() {
					sender = arg.username;
					password = arg.password;
					smtpHost = arg.smtpHost;
					smtpPort = arg.smtpPort;
					imapLock.leave();
					success();
				};
				var errorCalled = false;
				imap.onerror = function(err) {
					if (!errorCalled) {
						errorCalled = true;
						imapLock.leave();
						error(err);
					}
				}
				imap.connect();
			});
		},
		getFolders: function(success, error) {
			imapLock.take(function() {
				imap.listMailboxes(function(err, mailboxes) {
					imapLock.leave();
					if (err !== undefined && err !== null) {
						error(err);
					}
					else {
						success(mailboxes);
					}
				});
			});
		},
		getLastEmails: function(path, count, lastDate, success, error) {
			imapLock.take(function() {
				imap.selectMailbox(path || 'Inbox', function(err, mailbox){
					if (err !== undefined && err !== null) {
						imapLock.leave();
						error(err);
					} else {
						count = Math.min(count, mailbox.exists);
						searchEmails(count, lastDate || new Date(Date.now() + 1*24*60*60*1000), function(sids, hasMore){
							var intervals = getIntervals(sids);
							getEmailsByIntervals(intervals, function(messages){
								imapLock.leave();
								messages.sort(function(a, b){
									return new Date(b.envelope.date).valueOf() - new Date(a.envelope.date).valueOf();
								});
								if (lastDate) {
									messages = messages.filter(function(msg){
										return new Date(msg.envelope.date) <= lastDate;
									});
								}
								success({ messages: messages.slice(0, count).map(parseMessage), hasMore: hasMore && count != mailbox.exists });
							}, error);
						}, error);
					}
				});
			});
		},
		getNewEmails: function(path, firstDate, success, error) {
			path = path || 'Inbox';
			imapLock.take(function() {
				imap.selectMailbox(path, function(err, mailbox){
					if (err !== undefined && err !== null) {
						imapLock.leave();
						error(err);
					} else {
						if (mailbox.exists == 0) {
							imapLock.leave();
							success([]);
						} else {
							imap.search({ since: new Date(firstDate - 24*60*60*1000) }, {}, function(err, sids){
								if (err !== undefined && err !== null) {
									imapLock.leave();
									error(err);
								} else {
									var intervals = getIntervals(sids);
									getEmailsByIntervals(intervals, function(messages){
										imapLock.leave();
										success(messages.filter(function(msg) { return new Date(msg.envelope.date) >= firstDate }).map(parseMessage));
									}, error);
								}
							});
						}
					}
				});
			});
		},
		setEmailRead: function(path, uid, success, error) {
			imapLock.take(function() {
				if (selectedFolder != path) {
					imap.selectMailbox(path, function(err, mailbox){
						if (err !== undefined && err !== null) {
							imapLock.leave();
							error(err);
						}
						else {
							selectedFolder = path;
							setEmailRead();
						}
					});
				} else {
					setEmailRead();
				}
				
				function setEmailRead() {
					imap.setFlags(uid + ':' + uid, { add: ['\\Seen'] }, { byUid: true }, function(err, result) {
						imapLock.leave();
						if (err !== undefined && err !== null) {
							error(err);
						}
						else {
							success();
						}
					});
				}
			});
		},
		getEmailAttachment: function(path, uid, part, success, error) {
			imapLock.take(function() {
				if (selectedFolder != path) {
					imap.selectMailbox(path, function(err, mailbox){
						if (err !== undefined && err !== null) {
							imapLock.leave();
							error(err);
						}
						else {
							selectedFolder = path;
							getEmailAttachment();
						}
					});
				} else {
					getEmailAttachment();
				}
				
				function getEmailAttachment() {
					imap.listMessages(uid + ':' + uid, ['body['+part+']'], { byUid: true }, function(err, messages) {
						imapLock.leave();
						if (err !== undefined && err !== null) {
							error(err);
						}
						else {
							var body = messages[0]['body['+part+']'];
							var parser = new MimeParser();
							var attachment;
							parser.onheader = function(node) {};
							parser.onbody = function(node, chunk){
								attachment = {
									contentType: node.headers['content-type'][0].value,
									fileName: node.headers['content-disposition'][0].params.filename,
									size: node.headers['content-disposition'][0].params.size,
									chunk: chunk
								};
							};
							parser.onend = function(){
								var base64Data = btoa(String.fromCharCode.apply(null, attachment.chunk));
								success(base64Data);
							};
							parser.write(body);
							parser.end();
						}
					});
				}
			});
		},
		sendEmail: function(arg, success, error) {
			var alreadySending = false;
			var client = new SmtpClient(smtpHost, smtpPort, {
				//useSecureTransport: true,
				name: sender,
				auth: {
					user: sender,
					pass: password
				}
			});
			client.onidle = function(){
				if(alreadySending){
					return;
				}
				alreadySending = true;
				client.useEnvelope({
					from: sender,
					to: arg.to
				});
			};
			client.onready = function(failedRecipients){
				if(failedRecipients.length){
					error("The following addresses were rejected: " + failedRecipients.join());
				}
				else {
					client.send("Subject: " + arg.subject + "\r\n");
					client.send("\r\n");
					client.send(arg.body);
					client.end();
					success();
				}
			};
			client.onerror = function(err) {
				error(err);
			};
			client.connect();
		},
		close() {
			imap.close();
		},
		getAccount() {
			return sender;
		}
	}

	function searchEmails(count, dateBefore, success, error) {
		imap.search({ on: dateBefore }, {}, function(err, ssidsOnDate){
			if (err !== undefined && err !== null) {
				imapLock.leave();
				error(err);
			} else {
				searchOldEmails(count + ssidsOnDate.length, dateBefore, addDays(dateBefore, -7), ssidsOnDate, success, error);
			}
		});
	}

	function searchOldEmails(count, dateBefore, dateSince, result, success, error) {
		imap.search({ before: dateBefore, since: dateSince }, {}, function(err, sids){
			if (err !== undefined && err !== null) {
				imapLock.leave();
				error(err);
			} else {
				var newResult = result.concat(sids);
				var ellapsedDays = Math.round((dateBefore - dateSince) / (24*60*60*1000));
				if (newResult.length >= count || dateSince.valueOf() <= 0) {
					if (newResult.length <= count*2 || ellapsedDays == 7) {
						success(newResult, dateSince.valueOf() > 0);
					} else {
						searchOldEmails(count, dateBefore, addDays(dateBefore, -7), result, success, error);
					}
				} else {
					searchOldEmails(count, dateSince, addDays(dateSince, -ellapsedDays*2), newResult, success, error);
				}
			}
		});
	}

	function getEmailsByIntervals(uids, success, error, result) {
		result = result || [];
		if (uids.length == 0) {
			success(result);
		} else {
			imap.listMessages(uids[0], ['uid', 'flags', 'envelope', 'bodystructure', 'body.peek[text]'], {}, function(err, messages){
				if (err !== undefined && err !== null) {
					imapLock.leave();
					error(err);
				} else {
					getEmailsByIntervals(uids.slice(1), success, error, result.concat(messages));
				}
			});
		}
	}

	function getIntervals(sids) {
		if (sids.length == 0) {
			return [];
		} else {
			sids.sort(function(a, b) { return a - b; });
			var intervals = [];
			var begin = sids[0];
			for (var i = 1; i < sids.length; i++) {
				if (sids[i] != sids[i - 1] + 1) {
					intervals.push(begin + ":" + sids[i - 1]);
					begin = sids[i];
				}
			}
			intervals.push(begin + ":" + sids[sids.length - 1]);
			return intervals;
		}
	}

	function parseMessage(message) {
		var body = message['body[text]'];
		message['body[text]'] = undefined;
		message.text = body;
		message.contentType = message.bodystructure.type;
		if (message.bodystructure.type == 'text/html' || message.bodystructure.type == 'text/plain') {
			if (message.bodystructure.encoding == 'quoted-printable') {
				message.text = quoted_printable_decode(body);
			}
		} else {
			var bodies = [body];
			if (message.bodystructure.parameters && message.bodystructure.parameters.boundary) {
				var data = body.split(message.bodystructure.parameters.boundary);
				bodies = data.slice(1, data.length - 1).map(function(p){ return data[0] + p });
			}
			var parts = [];
			bodies.forEach(function(body){
				var parser = new MimeParser();
				parser.onheader = function(node) {};
				parser.onbody = function(node, chunk){
					parts.push({
						contentType: node.headers['content-type'][0].value,
						charset: node.charset,
						chunk: chunk
					});
				};
				parser.onend = function(){};
				parser.write(body);
				parser.end();
			});
			var part = null;
			part = first(parts, function(e){ return e.contentType == 'text/html' && e.charset == 'utf-8'; });
			if (part == null)
				part = first(parts, function(e){ return e.contentType == 'text/plain' && e.charset == 'utf-8'; });
			if (part != null) {
				message.text = Utf8ArrayToStr(part.chunk);
				message.contentType = part.contentType;
			}
		}
		return message;
	}
}

function first(array, func) {
    for (var i = 0; i < array.length; i++) {
       if (func(array[i]))
            return array[i]; 
    };
    return null;
}

function addDays(date, days) {
	var resultDate = new Date(date.valueOf());
	resultDate.setDate(date.getDate() + days);
	return resultDate;
}

// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */
function Utf8ArrayToStr(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
    c = array[i++];
    switch(c >> 4)
    { 
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
                       ((char2 & 0x3F) << 6) |
                       ((char3 & 0x3F) << 0));
        break;
    }
    }

    return out;
}
function quoted_printable_decode (str) { 
  // eslint-disable-line camelcase
  //       discuss at: http://locutus.io/php/quoted_printable_decode/
  //      original by: Ole Vrijenhoek
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //      bugfixed by: Theriault (https://github.com/Theriault)
  // reimplemented by: Theriault (https://github.com/Theriault)
  //      improved by: Brett Zamir (http://brett-zamir.me)
  //        example 1: quoted_printable_decode('a=3Db=3Dc')
  //        returns 1: 'a=b=c'
  //        example 2: quoted_printable_decode('abc  =20\r\n123  =20\r\n')
  //        returns 2: 'abc   \r\n123   \r\n'
  //        example 3: quoted_printable_decode('012345678901234567890123456789012345678901234567890123456789012345678901234=\r\n56789')
  //        returns 3: '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
  //        example 4: quoted_printable_decode("Lorem ipsum dolor sit amet=23, consectetur adipisicing elit")
  //        returns 4: 'Lorem ipsum dolor sit amet#, consectetur adipisicing elit'

  // Decodes all equal signs followed by two hex digits
  var RFC2045Decode1 = /=\r\n/gm

  // the RFC states against decoding lower case encodings, but following apparent PHP behavior
  var RFC2045Decode2IN = /=([0-9A-F]{2})/gim
  // RFC2045Decode2IN = /=([0-9A-F]{2})/gm,

  var RFC2045Decode2OUT = function (sMatch, sHex) {
    return String.fromCharCode(parseInt(sHex, 16))
  }

  return str.replace(RFC2045Decode1, '')
    .replace(RFC2045Decode2IN, RFC2045Decode2OUT)
}