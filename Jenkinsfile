pipeline {
agent any


stages {

    stage('Build Docker Images') {
        steps {
            sh 'docker build -t pks2906/poker-backend -f docker/backend.Dockerfile .'
            sh 'docker build -t pks2906/poker-websocket -f docker/websocket.Dockerfile .'
            sh 'docker build -t pks2906/poker-user-frontend -f docker/frontend.Dockerfile .'
            sh 'docker build -t pks2906/poker-admin-frontend -f docker/frontend.Dockerfile .'
        }
    }
stage('Push Images to Docker Hub') {
steps {
withCredentials([usernamePassword(
credentialsId: 'dockerhub',
usernameVariable: 'DOCKER_USER',
passwordVariable: 'DOCKER_PASS'
)]) {

        sh '''
        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

        docker push pks2906/poker-backend
        docker push pks2906/poker-websocket
        docker push pks2906/poker-user-frontend
        docker push pks2906/poker-admin-frontend
        '''
    }
}


}



    stage('Deploy to Kubernetes') {
        steps {
            sh 'kubectl apply -f k8s/'
        }
    }

}


}
