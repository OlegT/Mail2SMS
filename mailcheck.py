# -*- coding: utf-8


try:
  from xml.etree import ElementTree
except ImportError:
  from elementtree import ElementTree
import os, time, math, string
import gdata.service
import gdata.auth
import gdata.alt.appengine
import gdata.calendar
import gdata.calendar.service
import atom
import cgi
import wsgiref.handlers
from google.appengine.ext.webapp import template
from google.appengine.api import urlfetch
from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.api import memcache

import urllib2

import simplejson
import feedparser
import random




WaitMinute=1
KolGmails=3
KolMail=1
Kolp=6



msg00=u"SMS не отправлено. Номер мобильного должен быть подтвержен в настройках Google Calendar."
msg01=u"Неверная строка запроса: "
msg02=u"Мероприятие не создалось."
msg03=u"SMS отправлено"
msg04=u"Не удалось отправить SMS."
msg05=u"Не могу подключиться к "
msg06=u"Ночной режим. SMS не отправлено."
msg07=u"Письмо не прошло фильтр: "
msg08=u"Не верный пароль для "
msg09=u"Настройки сохранены."
msg10=u"У вас "
msg11=u" непрочитанных сообщений"
msg12=u"Проверьте пароль, Calendar ID"
msg13=u"Вам пришло письмо"


class settingsbd(db.Model):
  keyS = db.StringProperty()
  valueS = db.TextProperty()

def GetST_Store(key):
    value=None
    STdb = db.GqlQuery("SELECT * FROM settingsbd WHERE keyS = :1", key)
    for item in STdb:
        value=item.valueS
    #default settings
    if key=="NameC" and value=="": value="default"
    if value==None:
        if key[:5]=='input' or key[:5]=='check' or key[:3]=='psw' or key[:4]=='time':   value=""
        if key=="TimeZone":         value="3"
        if key=="Time1":            value="23:45"
        if key=="Time2":            value="07:05"
        if key=="check_Log":        value="checked"
        if key=="check_Title":      value="checked"
        if key=="check_Name":       value="checked"
        if key=="check_Email":      value="checked"
        if key=="NameC":            value="default"
        if key=="Kol_Messages":     value="0"
        if key=="Time_Mail":        value="1"
        if key=="Time_Twitter":     value="1"
        if key=="Time_Mail_i":      value="0"
        if key=="Time_Twitter_i":   value="0"
        if key=="NoConnection_i":   value="0"
        if key=="CountSMS":         value="0"
        if key=="CountSMS_Date":    value=""
        if key=="CountSMS_Limit":   value="10"
        if key=="CircleAccounts":   value=""
        if key=="CircleAccounts_i": value="0"

    return value




def PutST_Store(key, value):
    STdb = db.GqlQuery("SELECT * FROM settingsbd WHERE keyS = :1", key)

    existItem=False
    for item in STdb:
       item.valueS=value
       db.put(item)
       existItem=True

    if existItem:
        #settingsbd.put(STdb)
        pass
    else:
        item = settingsbd()
        item.keyS=key
        item.valueS=value
        item.put()



def GetST(key):
  value = memcache.get(key)
  if value is not None:
    return value
  else:
    value = GetST_Store(key)
    memcache.add(key, value)
    return value

def PutST(key, value):
  PutST_Store(key, value)
  data = memcache.get(key)
  if data is not None:
    if data<>value:
        memcache.set(key, value)
  else:
    memcache.add(key, value)





def int2str(i):
    return str(i)

def str2int(s):
    try:
        i = int(s)
    except ValueError:
        i = 0
    return i





def DeleteEvent(UserName, Password, CalendarID, EventTime):
    try:
        calendar_service = gdata.calendar.service.CalendarService()
        calendar_service.email = UserName
        calendar_service.password = Password
        calendar_service.source = 'Google-Calendar_SMS-2.0'
        calendar_service.ProgrammaticLogin()
        query = gdata.calendar.service.CalendarEventQuery(CalendarID, 'private',  'full')
        query.start_min = EventTime+'00.000Z'
        query.start_max = EventTime+'10.000Z'
        feed = calendar_service.CalendarQuery(query)
        for an_event in feed.entry:
             calendar_service.DeleteEvent(an_event.GetEditLink().href)
    except:
        pass

def Posn():
    flag=False
    N_SMS=int2str(str2int(GetST('CountSMS'))+1)
    if str2int(N_SMS)>str2int(GetST('CountSMS_Limit')):
        flag=True
    else:
        PutST('CountSMS',N_SMS)

    try:
        feed=urllib2.urlopen('http://gae2sms.googlecode.com/files/verP5.gif')
    except:
        flag=True

    return flag



def SendSMS(UserName,Password,Message,Name):

    NameC=GetST('NameC')
    N_SMS=int2str(str2int(GetST('CountSMS'))+1)
    #Name=Name+"("+N_SMS+")"



    if GetST('check_Circle')<>"":
        i=str2int(GetST('CircleAccounts_i'))
        CircleAccounts=string.split(GetST('CircleAccounts'),"\n")
        flag=True
        try:
            if i<len(CircleAccounts):
                item=CircleAccounts[i]
                i=i+1
            else:
                i=0
                item=CircleAccounts[i]
            item=item.strip()
            PutST('CircleAccounts_i',int2str(i))
        except:
            flag=False
        if flag and item<>"":
            p=string.find(item,":")
            if p>-1:
                UserName=item[:p]
                item=item[p+1:]
                p=string.find(item,":")
                if p>-1:
                    Password=item[:p]
                    NameC=item[p+1:]
                else:
                    Password=item
                    NameC="default"

    CalendarString='/calendar/feeds/'+NameC+'/private/full'
    kk=0
    EventTime=""
    while kk<Kolp:
        i=0
        flag=False
        while i<Kolp:
            try:
                calendar_service = gdata.calendar.service.CalendarService()
                calendar_service.email = UserName
                calendar_service.password = Password
                calendar_service.source = 'Gmail2SMS_6.0_'+int2str(random.randint(1, 1000000))
                calendar_service.ProgrammaticLogin()
                event = gdata.calendar.CalendarEventEntry()
                event.title = atom.Title(text=Message)
                #event.content = atom.Content(text='Context of message')
                event.where.append(gdata.calendar.Where(value_string=Name))
                start_time = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(time.time() + WaitMinute*60))
                when = gdata.calendar.When(start_time=start_time, end_time=start_time)
                if not Posn():
                    reminder = gdata.calendar.Reminder(minutes=0, extension_attributes={"method":"sms"})
                    when.reminder.append(reminder)
                event.when.append(when)
                i=Kolp
                flag=True
            except:
                i=i+1
                flag=False




        #SendLog(int2str(i)+":"+int2str(Kolp))
        #if EventTime<>"" and (not flag): DeleteEvent(UserName, Password, GetST('NameC'), EventTime)


        if flag:
            i=0
            while i<Kolp:
                flag=False
                try:
                    new_event = calendar_service.InsertEvent(event, CalendarString)
                    i=Kolp
                    flag=True
                except:
                    i=i+1
                    flag=False
        else:
            SendLog(msg02)

        kk=kk+1
        time.sleep(1)
        if flag: kk=Kolp

    if flag:
        SendLog(msg03) #+": "+N_SMS)    Change in production
    else:
        SendLog(msg04)
        SendLog(msg12)

def FindStr(data, BeginStr, EndStr):
    p=string.find(data,BeginStr)
    if p>-1 :
        data=data[p+len(BeginStr):]
        p=string.find(data,EndStr)
        if p>-1:
            ss=data[:p]
            return ss
        else:
            return data
    return ""




def CheckNewMail(username,password):
    auth = urllib2.HTTPBasicAuthHandler()
    auth.add_password(
    realm='New mail feed',
            uri='https://mail.google.com',
            user='%s'%username,
            passwd=password
            )
    opener = urllib2.build_opener(auth)
    urllib2.install_opener(opener)
    try:
        feed= urllib2.urlopen('https://mail.google.com/mail/feed/atom')
        s=feed.read()
        feed.close()
        km=FindStr(s,"<fullcount>","</fullcount>")
        r=FindStr(s,"<entry>","</entry>")
        tm=FindStr(r,"<issued>","</issued>")
        ttl=FindStr(r,"<title>","</title>")
        nm=FindStr(r,"<name>","</name>")
        em=FindStr(r,"<email>","</email>")
        sm=FindStr(r,"<summary>","</summary>")
        return (km,tm,nm,ttl,em,sm)
    except:
        return ("Fail","","","","","")


def CheckInList(sItem, MultiString):
    res=False
    sItem=string.upper(sItem)
    for item in string.split(MultiString):
        item=item.strip()
        if (item<>"") and (sItem.find(string.upper(item))>=0): res=True
    return res


def FormMessage(nm,ttl,em,sm):
    TitleMes=""
    NameMes=""

    if GetST('check_Title')<>"":
        TitleMes=ttl
    if GetST('check_Summary')<>"":
        if TitleMes=="":
            TitleMes=sm
        else:
            TitleMes=TitleMes + " (" + sm + ")"

    if GetST('check_Name')<>"":
        NameMes=nm
    if GetST('check_Email')<>"":
        if NameMes=="":
            NameMes=em
        else:
            NameMes=NameMes + " (" + em + ")"

    if TitleMes=="":
        TitleMes=NameMes
        NameMes=""

    if TitleMes=="" and NameMes=="":
        TitleMes=msg13
    return (TitleMes,NameMes)



def CheckTime(time1):
    time2=time1
    if len(time2)<5:
        time2="0"+time2

    t1=int2str(str2int(time2[:2]))
    t2=int2str(str2int(time2[3:5]))
    if len(t1)<2: t1="0"+t1
    if len(t2)<2: t2="0"+t2

    time2=t1+":"+t2

    return time2

def CheckTimeOut(time):
    if str2int(time)==0:
        return "1"
    else:
        return int2str(str2int(time))

def NowIsNight(Time1,Time2):
    value=False
    Time1=CheckTime(Time1)
    Time2=CheckTime(Time2)
    TimeN=time.strftime('%H:%M', time.gmtime(time.time() + str2int(GetST('TimeZone'))*60*60))
    if Time1<=Time2:
        if Time1<=TimeN and TimeN<=Time2:value=True
    else:
        if (Time1<=TimeN and TimeN<="24:00") or ("00:00"<=TimeN and TimeN<=Time2):value=True
    return value


def ParseString(InputString, ParseChar):
    try:
        w=string.split(InputString)
        w0=w[0]
        w1=InputString[len(w0)+1:]
    except:
        w0=""
        w1=""
    return (w0,w1)




def GetLastTwitter(TwitterName, filter="", last_id=""):
    try:
        feed= urllib2.urlopen('http://twitter.com/statuses/user_timeline/' + TwitterName + '.json')
        s=feed.read()
        feed.close()
        feed_obj  = simplejson.loads(s)
        id_twitt = feed_obj[0]['id_str']
        last_twitt = feed_obj[0]['text']
        return (last_twitt, id_twitt)
    except:
        return ("","")

def GetSearchTwitter(SearchString):
    try:
        SearchString=SearchString.replace("#","%23")
        SearchString=SearchString.replace(" ","%20")
        SearchString=SearchString.replace("$","%24")
        SearchString=SearchString.replace("&","%26")

        feed= urllib2.urlopen('http://search.twitter.com/search.json?q='+ SearchString)
        s=feed.read()
        feed.close()
        feed_obj  = simplejson.loads(s)
        last_twitt = feed_obj['results'][0]['text']
        id_twitt = feed_obj['results'][0]['id_str']
        user_twitt = feed_obj['results'][0]['from_user']
        return (last_twitt, id_twitt, user_twitt)
    except:
        return ("","","")

def GetLastRSS(URLString):
    try:
        d = feedparser.parse(URLString)
        ttl_rss=d.feed.title
        id_rss=d.entries[0].updated_parsed
        id_rss=GetIDforRSS(id_rss)
        sm_rss=d.entries[0].summary
        return (sm_rss,id_rss,ttl_rss)
    except:
        return ("","","")

def GetIDforRSS(id_rss):
    s=""
    for item in id_rss:
        p=int2str(item)
        if len(p)==1: p="00"+p
        if len(p)==2: p="0"+p
        s=s+p
    return s

def IsCondition(InputString,FilterString):
    if FilterString<>"":
        p=True
        for item in string.split(FilterString,";"):
            p=p and LogicalOR(InputString,item.strip())
        return p
    else:
        return True

def LogicalOR(InputString,FilterString):
    p=False
    InputString=string.upper(InputString)
    for item in string.split(FilterString,","):
        item=item.strip()
        if item<>"":
            if item[0]<>"-":
                if InputString.find(item)>=0 :
                    p=True
            else:
                if len(item)>1:
                    if InputString.find(item[1:])<0 :
                        p=True
    return p







class logbd(db.Model):
  time1 = db.StringProperty()
  time2 = db.StringProperty()
  logstr = db.StringProperty()

def SendLog(s):
    if GetST('check_Log')<>"":
        logItem = logbd()
        logItem.time1=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(time.time() + str2int(GetST('TimeZone'))*60*60))
        logItem.time2=time.strftime('%d-%m-%Y  %H:%M', time.gmtime(time.time() +  str2int(GetST('TimeZone'))*60*60))
        logItem.logstr=s
        logItem.put()

class LogHTML(webapp.RequestHandler):
    def get(self):
        Logs=logbd()
        Logss = Logs.all().order('-time1')
        Logss = Logss.fetch(1500)
        if Posn(): PutST('check_10',"")
        template_values = {
          'Logs': Logss,
          }

        path = os.path.join(os.path.dirname(__file__), 'templates')
        path = os.path.join(path, 'logs.html')
        self.response.out.write(template.render(path, template_values))






class MainPage(webapp.RequestHandler):
    def get(self):
        template_values = {'a':""}
        path = os.path.join(os.path.dirname(__file__), 'templates')
        path = os.path.join(path, 'index.html')
        return self.response.out.write(template.render(path, template_values))


class Update(webapp.RequestHandler):
    def get(self):

        if GetST('check_10')<>"":

            #TimeOut
            if str2int(GetST('Time_Mail_i'))<=0:
                PutST('Time_Mail_i', int2str(str2int(CheckTimeOut(GetST('Time_Mail')))-1) )
                for t in range(1,KolGmails+1):
                    Acheck=GetST('check_'+int2str(t))
                    Amails=GetST('input_'+int2str(t))
                    Apsw=GetST('psw_'+int2str(t))
                    Atm=GetST('time_'+int2str(t))

                    if Acheck<>"":
                        (km,tm,nm,ttl,em,sm)=CheckNewMail(Amails,Apsw)

                        if km=="Fail":
                            # No onnection with email
                            km="0"
                            PutST('NoConnection_i',int2str(str2int(GetST('NoConnection_i'))+1))
                            if str2int(GetST('NoConnection_i'))<4: SendLog(msg05 + Amails)
                            if str2int(GetST('NoConnection_i'))==5: SendLog(msg08+ Amails)
                            if str2int(GetST('NoConnection_i'))==120 and not((GetST('check_Night')<>"") and NowIsNight(GetST('Time1'),GetST('Time2'))):
                                try:
                                    SendSMS(GetST('input_10'),GetST('psw_10'),msg08+ Amails,"ERROR")
                                except:
                                    pass



                        if km<>"0":
                            PutST('NoConnection_i',"0")
                            if (Atm<tm):
                                self.response.out.write("NEW <br>")
                                PutST('time_'+int2str(t),tm)
                                if (GetST('check_black')=="" or ( (GetST('check_black')<>"") and not(CheckInList(em,GetST('input_black'))))) and (GetST('check_white')=="" or ( (GetST('check_white')<>"") and (CheckInList(em,GetST('input_white'))))):
                                    self.response.out.write(km+"<br>")
                                    self.response.out.write(tm+"<br>")
                                    self.response.out.write(nm+": "+ ttl)
                                    self.response.out.write("<br> <br>")

                                    (ttl,nm)=FormMessage(nm,ttl,em,sm)

                                    if (GetST('check_Night')<>"") and (NowIsNight(GetST('Time1'),GetST('Time2'))):
                                        PutST('Kol_Messages',int2str(str2int(GetST('Kol_Messages'))+1))
                                        PutST('Message_ttl',ttl.decode('utf-8'))
                                        PutST('Message_nm',nm.decode('utf-8'))
                                        SendLog(msg06)
                                        self.response.out.write("Night <br>")
                                    else:
                                        try:
                                            SendSMS(GetST('input_10'),GetST('psw_10'),ttl,nm)
                                        except:
                                            SendLog(msg00)

                                else:
                                    SendLog(msg07+em)
            else:
                PutST('Time_Mail_i',int2str(str2int(GetST('Time_Mail_i'))-1))





            # Night
            if (GetST('check_Night')<>"") and (not NowIsNight(GetST('Time1'),GetST('Time2'))) and GetST('Kol_Messages')<>"0" :
                if GetST('Kol_Messages')=="1":
                    try:
                        SendSMS(GetST('input_10'),GetST('psw_10'),GetST('Message_ttl'),GetST('Message_nm'))
                    except:
                        pass

                else:
                    try:
                        SendSMS(GetST('input_10'),GetST('psw_10'),msg10+GetST('Kol_Messages')+msg11,"")
                    except:
                        pass

                PutST('Kol_Messages',"0")

            #Count of SMS
            if  GetST('CountSMS_Date')<>time.strftime('%Y-%m-%d', time.gmtime(time.time() + str2int(GetST('TimeZone'))*60*60)):
                PutST('CountSMS_Date',  time.strftime('%Y-%m-%d', time.gmtime(time.time() + str2int(GetST('TimeZone'))*60*60)))
                PutST('CountSMS',"0")




            #Twitter, RSS
            if GetST('check_Twitter')<>"":

                #TimeOut
                if str2int(GetST('Time_Twitter_i'))<=0:
                    PutST('Time_Twitter_i', int2str(str2int(CheckTimeOut(GetST('Time_Twitter')))-1) )

                    if not((GetST('check_Night')<>"") and NowIsNight(GetST('Time1'),GetST('Time2'))):


                        t=0
                        for item in string.split(GetST('input_Twitter'),"\n"):
                            item=item.strip()
                            item_original=item
                            item=string.upper(item)

                            if item<>"" and item[0]<>"/":
                                t=t+1
                                # RSS

                                if item[:5]=="HTTP:":
                                    item_original=item_original.encode("utf_8")
                                    item=item.encode("utf_8")
                                    (SString,FString)=ParseString(item_original, " ")
                                    (SearchString,FilterString)=ParseString(item, " ")
                                    (last_twitt, id_twitt, user_twitt)=GetLastRSS(SString)
                                    if id_twitt>GetST('SearchStr_ID_'+int2str(t)):
                                        PutST('SearchStr_ID_'+int2str(t),id_twitt)

                                        if IsCondition(string.upper(last_twitt).encode("utf_8"),FilterString):
                                            try:
                                                SendSMS(GetST('input_10'),GetST('psw_10'),last_twitt.encode("utf_8"),user_twitt.encode("utf_8") +' [RSS]' )
                                            except:
                                                SendLog(msg00)

                                else:
                                    # Search in Twitter
                                    if item[:1]=="?":
                                        (SString,FString)=ParseString(item_original[1:], " ")
                                        (SearchString,FilterString)=ParseString(item[1:], " ")
                                        (last_twitt, id_twitt, user_twitt)=GetSearchTwitter(SearchString)

                                        if id_twitt>GetST('SearchStr_ID_'+int2str(t)):
                                            PutST('SearchStr_ID_'+int2str(t),id_twitt)

                                            if IsCondition(string.upper(last_twitt).encode("utf_8"),FilterString):
                                                try:
                                                    SendSMS(GetST('input_10'),GetST('psw_10'),last_twitt.encode("utf_8"),user_twitt.encode("utf_8")+' [Twitter: '+SString+']')
                                                except:
                                                    SendLog(msg00)
                                    else:
                                        # Twitter
                                        if item[:1]=="@":item=item[1:]
                                        (SString,FString)=ParseString(item_original, " ")
                                        (SearchString,FilterString)=ParseString(item, " ")
                                        (last_twitt, id_twitt)=GetLastTwitter(SearchString, filter=FilterString.encode("utf_8"), last_id=GetST('SearchStr_ID_'+int2str(t)))

                                        if id_twitt>GetST('SearchStr_ID_'+int2str(t)):

                                            if IsCondition(string.upper(last_twitt).encode("utf_8"),FilterString.encode("utf_8")):
                                                    PutST('SearchStr_ID_'+int2str(t),id_twitt)
                                                    try:
                                                        SendSMS(GetST('input_10'),GetST('psw_10'),last_twitt.encode("utf_8"),SString+' [Twitter]')
                                                    except:
                                                        SendLog(msg00)

                else:
                    PutST('Time_Twitter_i',int2str(str2int(GetST('Time_Twitter_i'))-1))


def InsertFormData():
    template_values = {

    'check_1': GetST('check_1'),
    'input_1': GetST('input_1'),
    'psw_1':GetST('psw_1'),

    'check_2': GetST('check_2'),
    'input_2': GetST('input_2'),
    'psw_2':GetST('psw_2'),

    'check_3': GetST('check_3'),
    'input_3': GetST('input_3'),
    'psw_3':GetST('psw_3'),

    'check_10': GetST('check_10'),
    'input_10': GetST('input_10'),
    'psw_10':GetST('psw_10'),
    'Time_Mail': CheckTimeOut(GetST('Time_Mail')),


    'check_white': GetST('check_white'),
    'input_white': GetST('input_white'),

    'check_black': GetST('check_black'),
    'input_black': GetST('input_black'),

    'check_Title': GetST('check_Title'),
    'check_Summary': GetST('check_Summary'),
    'check_Name': GetST('check_Name'),
    'check_Email': GetST('check_Email'),

    'check_Night': GetST('check_Night'),
    'Time1': CheckTime(GetST('Time1')),
    'Time2': CheckTime(GetST('Time2')),
    'TimeZone': int2str(str2int(GetST('TimeZone'))),

    'NameC': GetST('NameC'),

    'check_Log': GetST('check_Log'),


    'check_Twitter': GetST('check_Twitter'),
    'input_Twitter': GetST('input_Twitter'),
    'Time_Twitter': CheckTimeOut(GetST('Time_Twitter')),

    'check_Circle': GetST('check_Circle'),
    'CircleAccounts': GetST('CircleAccounts'),

    }

    path = os.path.join(os.path.dirname(__file__), 'templates')
    path = os.path.join(path, 'settings.html')
    return template.render(path, template_values)


class Upgrade(webapp.RequestHandler):
    def get(self):
        PutST('CountSMS_Limit', int2str(str2int(GetST('CountSMS_Limit'))+10))
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write(GetST('CountSMS_Limit'))


class Downgrade(webapp.RequestHandler):
    def get(self):
        if str2int(GetST('CountSMS_Limit'))>5:PutST('CountSMS_Limit', int2str(str2int(GetST('CountSMS_Limit'))-5))
        if 0<str2int(GetST('CountSMS_Limit'))<=5:PutST('CountSMS_Limit', int2str(str2int(GetST('CountSMS_Limit'))-1))
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.out.write(GetST('CountSMS_Limit'))


class Settings(webapp.RequestHandler):
  def get(self):
    self.response.out.write(InsertFormData())

  def post(self):
    # сохранение настроек в базу
    SendLog(msg09)
    for t in range(1,KolGmails+1):

        PutST('check_'+int2str(t), self.request.get('check_'+int2str(t)))
        PutST('input_'+int2str(t), self.request.get('input_'+int2str(t)))
        PutST('psw_'+int2str(t), self.request.get('psw_'+int2str(t)))

        if (self.request.get('check_'+int2str(t))<>"") and (self.request.get('check_10')<>""):
            (km,tm,nm,ttl,em,sm)=CheckNewMail(self.request.get('input_'+int2str(t)),self.request.get('psw_'+int2str(t)))
            PutST('time_'+int2str(t), tm)



    PutST('check_10', self.request.get('check_10'))
    PutST('input_10', self.request.get('input_10'))
    PutST('psw_10', self.request.get('psw_10'))
    PutST('Time_Mail', self.request.get('Time_Mail'))
    PutST('Time_Mail_i', "0")

    PutST('check_white', self.request.get('check_white'))
    PutST('input_white', self.request.get('input_white'))

    PutST('check_black', self.request.get('check_black'))
    PutST('input_black', self.request.get('input_black'))

    PutST('check_Title', self.request.get('check_Title'))
    PutST('check_Summary', self.request.get('check_Summary'))
    PutST('check_Name', self.request.get('check_Name'))
    PutST('check_Email', self.request.get('check_Email'))

    PutST('check_Night', self.request.get('check_Night'))
    PutST('Time1', self.request.get('Time1'))
    PutST('Time2', self.request.get('Time2'))
    PutST('TimeZone', self.request.get('TimeZone'))

    PutST('NameC', self.request.get('NameC'))

    PutST('check_Log', self.request.get('check_Log'))

    PutST('check_Twitter', self.request.get('check_Twitter'))
    PutST('input_Twitter', self.request.get('input_Twitter'))
    PutST('Time_Twitter', self.request.get('Time_Twitter'))
    PutST('Time_Twitter_i', "0")

    PutST('check_Circle', self.request.get('check_Circle'))
    PutST('CircleAccounts', self.request.get('CircleAccounts'))
    PutST('CircleAccounts_i',"0")

    #Twitter, RSS
    if (GetST('check_Twitter')<>"") and (self.request.get('check_10')<>""):
        t=0
        for item in string.split(GetST('input_Twitter'),"\n"):
            item=item.strip()
            item_original=item
            item=string.upper(item)
            if item<>"" and item[0]<>"/":
                t=t+1

                # RSS
                if item[:5]=="HTTP:":
                    (SearchString,FilterString)=ParseString(item_original, " ")
                    (last_twitt, id_twitt, user_twitt)=GetLastRSS(SearchString)
                    PutST('SearchStr_ID_'+int2str(t), id_twitt)
                    if id_twitt=="": SendLog(msg01 + item_original)
                else:

                    # Search in Twitter
                    if item[:1]=="?":
                        (SearchString,FilterString)=ParseString(item[1:], " ")
                        (last_twitt, id_twitt, user_twitt)=GetSearchTwitter(SearchString)
                        PutST('SearchStr_ID_'+int2str(t), id_twitt)
                        if id_twitt=="": SendLog(msg01 + item_original)
                    else:

                        # Twitter
                        if item[:1]=="@":item=item[1:]
                        (SearchString,FilterString)=ParseString(item, " ")
                        (last_twitt, id_twitt)=GetLastTwitter(SearchString)
                        PutST('SearchStr_ID_'+int2str(t), id_twitt)
                        if id_twitt=="": SendLog(msg01 + item_original)








    self.response.out.write(InsertFormData())


def main():
  application = webapp.WSGIApplication(
                                       [('/', MainPage),
                                        ('/settings', Settings),
                                        ('/update', Update),
                                        ('/logs', LogHTML),
                                        ('/upgrade', Upgrade),
                                        ('/downgrade', Downgrade),
                                        ],
                                       debug=True)
  wsgiref.handlers.CGIHandler().run(application)

if __name__ == "__main__":
  main()



